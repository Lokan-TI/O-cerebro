import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { buildConfig, execRead, closePool } from '../../shared/erpConnection.ts';

// Segmentação de clientes do ERP nos 5 fluxos de automação de e-mail.
// Base: pessoa (cadastro) + mkt_orcamento (orçamentos) + fich_loc/fl_remessa/fl_rem_equ
// (locações realizadas, equipamento e devolução) + fl_fatura (valor faturado).
//
// Regras (proxy do ERP, mutuamente exclusivas, avaliadas nesta ordem):
//  05 Pós-locação        → já teve locação realizada e devolveu tudo (nada em posse)
//  03 Interesse comercial→ orçamento/proposta nos últimos 30 dias e nunca locou
//  04 Recuperação        → orçamento/proposta há mais de 30 dias e nunca locou (pediu preço e sumiu)
//  01 Boas-vindas        → cadastro nos últimos 30 dias, sem orçamento e sem locação
//  02 Nutrição técnica   → cadastro antigo, sem orçamento e sem locação
// (clientes com equipamento em posse hoje ficam fora — estão em locação ativa)

function rowsOf(res: any) {
  if (!res) return [];
  if (Array.isArray(res.recordset) && res.recordset.length > 0) return res.recordset;
  if (Array.isArray(res.recordsets)) {
    for (let i = res.recordsets.length - 1; i >= 0; i--) {
      if (Array.isArray(res.recordsets[i]) && res.recordsets[i].length > 0) return res.recordsets[i];
    }
  }
  return [];
}

const toDate = (v: any) => {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  if (y < 1980 || y > 2100) return null;
  return d.toISOString().slice(0, 10);
};
const br = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '');
const maxIso = (...vals: (string | null)[]) => vals.filter(Boolean).sort().pop() || null;
const daysAgo = (iso: string | null) => (iso ? Math.round((Date.now() - new Date(iso).getTime()) / 86400000) : null);

const REM_BASE = `FROM fich_loc f WITH (NOLOCK)
      JOIN fl_remessa r WITH (NOLOCK) ON r.cd_controle = f.cd_controle
      WHERE r.dt_saida IS NOT NULL
        AND ISNULL(r.fl_rem_cancelada,'') <> 'S'
        AND f.cd_pessoa IS NOT NULL AND f.cd_pessoa <> ''`;

Deno.serve(async (req) => {
  const source: any = { credential_reference: 'env' };
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Apenas administradores podem gerar esta segmentação.' }, { status: 403 });
    }
    if (!buildConfig(source)) return Response.json({ error: 'Configuração de conexão incompleta.' }, { status: 500 });

    const body = await req.json().catch(() => ({}));
    const somenteComEmail = body?.somente_com_email !== false;

    const queries = {
      pessoas: `SELECT p.cd_pessoa, p.nm_pessoa, p.nm_fan_pessoa, p.nr_cpf_pessoa, p.nr_cnpj_pessoa,
          p.cidade_pessoa, p.uf_pessoa, p.tel_pessoa, p.tl_cel_pessoa, p.en_mail_pessoa,
          p.dt_cad_pessoa, p.dt_ult_atividade
        FROM pessoa p WITH (NOLOCK)
        WHERE p.fl_cliente_pessoa = 1`,
      // mkt_orcamento está vazia nesta base: o orçamento/proposta é a própria ficha de
      // locação (fich_loc) que nunca gerou remessa com saída — "pediu preço e sumiu".
      orcamentos: `SELECT f.cd_pessoa, COUNT(*) AS qtd,
          MAX(f.dt_pedido) AS ult_orcamento,
          MAX(CASE WHEN f.dt_aprovacao IS NOT NULL THEN f.dt_pedido END) AS ult_aprovado
        FROM fich_loc f WITH (NOLOCK)
        WHERE f.cd_pessoa IS NOT NULL AND f.cd_pessoa <> ''
          AND NOT EXISTS (SELECT 1 FROM fl_remessa r WITH (NOLOCK)
            WHERE r.cd_controle = f.cd_controle AND r.dt_saida IS NOT NULL
              AND ISNULL(r.fl_rem_cancelada,'') <> 'S')
        GROUP BY f.cd_pessoa`,
      locacoes: `SELECT f.cd_pessoa, COUNT(*) AS qtd, MAX(r.dt_saida) AS ult_saida
        ${REM_BASE}
        GROUP BY f.cd_pessoa`,
      devolucoes: `SELECT f.cd_pessoa, MAX(d.dt_devolucao) AS ult_devolucao,
          SUM(CASE WHEN d.dt_devolucao IS NULL THEN 1 ELSE 0 END) AS itens_em_posse
        FROM fich_loc f WITH (NOLOCK)
        JOIN fl_remessa r WITH (NOLOCK) ON r.cd_controle = f.cd_controle
        JOIN fl_rem_equ e WITH (NOLOCK) ON e.cd_flremessa = r.cd_flremessa
        LEFT JOIN fl_dev_equ de WITH (NOLOCK) ON de.cd_flremequ = e.cd_flremequ
        LEFT JOIN fl_devolucao d WITH (NOLOCK) ON d.cd_fldevolucao = de.cd_fldevolucao
        WHERE r.dt_saida IS NOT NULL
          AND ISNULL(r.fl_rem_cancelada,'') <> 'S'
          AND f.cd_pessoa IS NOT NULL AND f.cd_pessoa <> ''
        GROUP BY f.cd_pessoa`,
      equipamento: `SELECT cd_pessoa, nm_equipto FROM (
          SELECT f.cd_pessoa, q.nm_equipto,
            ROW_NUMBER() OVER (PARTITION BY f.cd_pessoa ORDER BY r.dt_saida DESC) AS rn
          FROM fich_loc f WITH (NOLOCK)
          JOIN fl_remessa r WITH (NOLOCK) ON r.cd_controle = f.cd_controle
          JOIN fl_rem_equ e WITH (NOLOCK) ON e.cd_flremessa = r.cd_flremessa
          LEFT JOIN equipto q WITH (NOLOCK) ON q.cd_equipto = e.cd_equipto
          WHERE r.dt_saida IS NOT NULL
            AND ISNULL(r.fl_rem_cancelada,'') <> 'S'
            AND f.cd_pessoa IS NOT NULL AND f.cd_pessoa <> ''
        ) t WHERE rn = 1`,
      faturamento: `SELECT f.cd_pessoa, SUM(fat.vl_fatura) AS vl_total, MAX(fat.dt_geracao) AS ult_fatura
        FROM fl_fatura fat WITH (NOLOCK)
        JOIN fich_loc f WITH (NOLOCK) ON f.cd_controle = fat.cd_controle
        WHERE f.cd_pessoa IS NOT NULL AND f.cd_pessoa <> ''
        GROUP BY f.cd_pessoa`,
    };

    // Execução serial — o ERP não suporta consultas concorrentes de agregação.
    const data: Record<string, any[]> = {};
    for (const [key, sql] of Object.entries(queries)) {
      data[key] = rowsOf(await execRead(source, sql, 60000));
    }

    const idx = (rows: any[]) => {
      const m: Record<string, any> = {};
      for (const r of rows) m[String(r.cd_pessoa).trim()] = r;
      return m;
    };
    const orc = idx(data.orcamentos);
    const loc = idx(data.locacoes);
    const dev = idx(data.devolucoes);
    const equ = idx(data.equipamento);
    const fat = idx(data.faturamento);

    const out: any[] = [];
    let emLocacaoAtiva = 0;
    let semEmail = 0;

    for (const p of data.pessoas) {
      const key = String(p.cd_pessoa).trim();
      const o = orc[key];
      const l = loc[key];
      const d = dev[key];
      const f = fat[key];

      const dtCadastro = toDate(p.dt_cad_pessoa);
      const ultOrcamento = toDate(o?.ult_orcamento);
      const ultLocacao = toDate(l?.ult_saida);
      const ultDevolucao = toDate(d?.ult_devolucao);
      const emPosse = Number(d?.itens_em_posse || 0) > 0;
      const temLocacao = !!ultLocacao;
      const diasOrcamento = daysAgo(ultOrcamento);
      const diasCadastro = daysAgo(dtCadastro);

      if (emPosse) { emLocacaoAtiva++; continue; }

      const email = String(p.en_mail_pessoa || '').trim();
      if (!email) { semEmail++; if (somenteComEmail) continue; }

      let fluxo = '';
      if (temLocacao) fluxo = 'Fluxo 05 - Pós-locação';
      else if (ultOrcamento && diasOrcamento !== null && diasOrcamento <= 30) fluxo = 'Fluxo 03 - Interesse comercial';
      else if (ultOrcamento) fluxo = 'Fluxo 04 - Recuperação';
      else if (diasCadastro !== null && diasCadastro <= 30) fluxo = 'Fluxo 01 - Boas-vindas';
      else fluxo = 'Fluxo 02 - Nutrição técnica';

      const ultimaInteracao = maxIso(ultLocacao, ultDevolucao, ultOrcamento, toDate(p.dt_ult_atividade), dtCadastro);

      out.push({
        fluxo,
        cd_pessoa: Number(p.cd_pessoa) || key,
        nome: String(p.nm_pessoa || '').trim(),
        nome_fantasia: String(p.nm_fan_pessoa || '').trim(),
        email,
        telefone: String(p.tel_pessoa || '').trim(),
        celular: String(p.tl_cel_pessoa || '').trim(),
        cpf: String(p.nr_cpf_pessoa || '').trim(),
        cnpj: String(p.nr_cnpj_pessoa || '').trim(),
        cidade: String(p.cidade_pessoa || '').trim(),
        uf: String(p.uf_pessoa || '').trim(),
        dt_cadastro: br(dtCadastro),
        qtd_orcamentos: Number(o?.qtd || 0),
        dt_ultimo_orcamento: br(ultOrcamento),
        orcamento_aprovado: o?.ult_aprovado ? 'Sim' : 'Não',
        qtd_locacoes: Number(l?.qtd || 0),
        dt_ultima_locacao: br(ultLocacao),
        dt_ultima_devolucao: br(ultDevolucao),
        ultimo_equipamento: String(equ[key]?.nm_equipto || '').trim(),
        valor_faturado: Number(f?.vl_total || 0),
        dt_ultima_interacao: br(ultimaInteracao),
        dias_sem_interacao: daysAgo(ultimaInteracao) ?? '',
      });
    }

    const counts: Record<string, number> = {};
    for (const r of out) counts[r.fluxo] = (counts[r.fluxo] || 0) + 1;

    // Campos vazios são removidos para reduzir o tamanho da resposta (a planilha
    // já trata ausência como vazio). Evita estouro de payload na base completa.
    for (const r of out) {
      for (const k of Object.keys(r)) {
        if (r[k] === '' || r[k] === null || r[k] === undefined) delete r[k];
      }
    }

    // O pool precisa ser liberado também no caminho de sucesso, senão as conexões
    // do ERP se esgotam e as chamadas seguintes falham com 500.
    try { await closePool(source); } catch { /* ignore */ }

    return Response.json({
      success: true,
      rows: out,
      total: out.length,
      counts,
      excluidos_em_locacao_ativa: emLocacaoAtiva,
      clientes_sem_email: semEmail,
      somente_com_email: somenteComEmail,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    try { await closePool(source); } catch { /* ignore */ }
    return Response.json({ error: (error as Error).message || String(error) }, { status: 500 });
  }
});