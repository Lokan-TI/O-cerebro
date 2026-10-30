import { canView } from '../../shared/access.ts';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { buildConfig, execRead } from '../../shared/erpConnection.ts';
import { isAberta } from '../../shared/fichaLifecycle.ts';

// Listagem bruta de contratos abertos (fich_loc sem encerramento), no grão ITEM do contrato
// (fl_rem_equ). O front agrupa por contrato. Paginação keyset por cd_flremequ.

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

// Mesmo critério do filtro "Aberta" da tela Ficha de Locação do Sisloc
const ABERTA = isAberta('f');
// Limite do banco: o máximo que cabe antes de o gateway (~100s) cortar a chamada.
const DB_TIMEOUT = 85000;

const iso = (v: any) => {
  if (!v || !(v instanceof Date) && typeof v !== 'string') return v ?? null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!canView(user)) return Response.json({ error: 'Apenas administradores.' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const source = await base44.asServiceRole.entities.ErpDataSource.get(body.source_id);
    if (!source || !buildConfig(source)) return Response.json({ error: 'Fonte de dados inválida.' }, { status: 400 });

    const after = Math.max(0, Number(body.after) || 0);
    const limit = Math.min(1500, Math.max(100, Number(body.limit) || 1000));
    const emp = body.cd_empresa != null && body.cd_empresa !== '' ? ` AND f.cd_empresa = ${Number(body.cd_empresa)}` : '';

    const sql = `SELECT TOP ${limit}
        f.cd_controle, f.numero_prefixo, f.numero, f.numero_sufixo, f.cd_empresa, f.cd_empresa_mov,
        f.cd_pessoa, p.nm_pessoa, p.nm_fan_pessoa, f.cd_pessoa_fun, pfun.nm_pessoa AS nm_atendente,
        f.dt_pedido, f.dt_aprovacao, f.dt_fai_ficha, f.dt_faf_ficha, f.dt_prevista_devolucao,
        f.dt_min_devolucao, f.dt_fau_ficha, f.dt_fat_ficha, f.dt_prox_reajuste, f.dt_validade,
        f.cd_calcfat, cf.ds_calcfat, f.cd_atividade, a.ds_atividade, f.cd_regiao, rg.nm_regiao,
        f.cd_tpcontrato, f.cd_condpagto, f.cd_tipocob, f.cd_tab_preco, f.cd_projeto, f.cd_cr,
        f.vl_minimo_locacao, f.vl_preco_dia, f.vl_preco_dia_m2, f.vl_projeto, f.nr_periodos,
        f.nm_entrega, f.en_entrega, f.num_entrega, f.comp_entrega, f.br_entrega, f.ci_entrega,
        f.uf_entrega, f.cp_entrega, f.cnpj_entrega, f.contato, f.telefone, f.observacao,
        r.cd_flremessa, r.nr_contrato, r.dt_saida, r.dt_entrega, r.dt_cobranca,
        r.dt_ini_contrato, r.dt_fim_contrato, r.dt_encerramento AS dt_prev_retorno,
        e.cd_flremequ, e.cd_equipto, q.codigo AS cd_equipto_codigo, q.nm_equipto, e.ds_equipto,
        e.cd_patrimonio, pt.nr_patrimonio, q.cd_grupo, e.qt_remessa,
        ISNULL(dv.qt,0) AS qt_devolvida,
        e.vl_uni_locacao, e.vl_uni_diaria, e.vl_uni_tabela, e.vl_uni_indenizacao, e.vl_nf,
        e.ds_latitude, e.ds_longitude
      FROM fich_loc f WITH (NOLOCK)
      JOIN fl_remessa r WITH (NOLOCK) ON r.cd_controle = f.cd_controle
      JOIN fl_rem_equ e WITH (NOLOCK) ON e.cd_flremessa = r.cd_flremessa
      LEFT JOIN pessoa p WITH (NOLOCK) ON p.cd_pessoa = f.cd_pessoa
      LEFT JOIN pessoa pfun WITH (NOLOCK) ON pfun.cd_pessoa = f.cd_pessoa_fun
      LEFT JOIN equipto q WITH (NOLOCK) ON q.cd_equipto = e.cd_equipto
      LEFT JOIN patrimon pt WITH (NOLOCK) ON pt.cd_patrimonio = e.cd_patrimonio
      LEFT JOIN atividade a WITH (NOLOCK) ON a.cd_atividade = f.cd_atividade
      LEFT JOIN regiao rg WITH (NOLOCK) ON rg.cd_regiao = f.cd_regiao
      LEFT JOIN calcfat cf WITH (NOLOCK) ON cf.cd_calcfat = f.cd_calcfat
      OUTER APPLY (SELECT SUM(d.qt_devolucao) AS qt FROM fl_dev_equ d WITH (NOLOCK) WHERE d.cd_flremequ = e.cd_flremequ) dv
      WHERE ${ABERTA}${emp}
        AND r.fl_rem_cancelada = 'N'
        ${body.incluir_devolvidos ? '' : 'AND e.qt_remessa > ISNULL(dv.qt,0)'}
        ${Array.isArray(body.controles) && body.controles.length ? `AND f.cd_controle IN (${body.controles.map(Number).filter(Number.isInteger).slice(0, 500).join(',') || 'NULL'})` : ''}
        AND e.cd_flremequ > ${after}
      ORDER BY e.cd_flremequ`;

    const sqlRenov = `SELECT TOP ${limit}
        ft.cd_flfatura, ft.cd_controle, f.numero_prefixo, f.numero, f.numero_sufixo, f.cd_empresa,
        f.cd_pessoa, p.nm_pessoa, ft.dt_geracao, ft.dt_inicio, ft.dt_fim, ft.dt_fim_ajuste,
        ft.vl_fatura, ft.vl_minimo_locacao, ft.fatura_complementar, ft.cd_nf
      FROM fl_fatura ft WITH (NOLOCK)
      JOIN fich_loc f WITH (NOLOCK) ON f.cd_controle = ft.cd_controle
      LEFT JOIN pessoa p WITH (NOLOCK) ON p.cd_pessoa = f.cd_pessoa
      WHERE ${ABERTA} AND ft.cd_flfatura > ${after}${emp}__CTRLFT__
      ORDER BY ft.cd_flfatura`;
    // Modos brutos: todas as colunas originais de cada tabela, sem simplificação
    const openF = `FROM fich_loc f WITH (NOLOCK) WHERE ${ABERTA}${emp}`;
    // Lista explícita de fichas: busca indexada por cd_controle, evita varrer fl_rem_equ inteira (timeout).
    const ctrls = Array.isArray(body.controles) ? body.controles.map(Number).filter(Number.isInteger).slice(0, 500) : [];
    const inCtrl = ctrls.length ? `r.cd_controle IN (${ctrls.join(',')})` : null;
    const sqlRenovF = sqlRenov.replace('__CTRLFT__', ctrls.length ? ` AND ft.cd_controle IN (${ctrls.join(',')})` : '');
    // Pré-resolve ids pequenos (pessoas/remessas das fichas) para buscas indexadas por IN literal.
    const idList = async (q: string, k: string) => [...new Set(rowsOf(await execRead(source, q, DB_TIMEOUT)).map((r: any) => Number(r[k])).filter(Number.isInteger))].join(',');
    const pesIds = ctrls.length && body.mode === 'raw_pessoas'
      ? await idList(`SELECT DISTINCT f.cd_pessoa FROM fich_loc f WITH (NOLOCK) WHERE f.cd_controle IN (${ctrls.join(',')})`, 'cd_pessoa') : '';
    const remIds = ctrls.length && body.mode === 'raw_itens'
      ? await idList(`SELECT r.cd_flremessa FROM fl_remessa r WITH (NOLOCK) WHERE r.cd_controle IN (${ctrls.join(',')})`, 'cd_flremessa') || 'NULL' : '';
    const pesFilter = ctrls.length
      ? `p.cd_pessoa IN (${pesIds || 'NULL'})`
      : `EXISTS (SELECT 1 ${openF} AND f.cd_pessoa = p.cd_pessoa)`;
    const RAW: Record<string, [string, string]> = {
      raw_fichas: [`SELECT TOP ${limit} f.* ${openF} AND f.cd_controle > ${after} ORDER BY f.cd_controle`, 'cd_controle'],
      raw_pessoas: [`SELECT TOP ${limit} p.* FROM pessoa p WITH (NOLOCK) WHERE p.cd_pessoa > ${after}
        AND ${pesFilter} ORDER BY p.cd_pessoa`, 'cd_pessoa'],
      raw_remessas: [`SELECT TOP ${limit} r.* FROM fl_remessa r WITH (NOLOCK) WHERE r.fl_rem_cancelada = 'N' AND r.cd_flremessa > ${after}
        AND ${inCtrl || `EXISTS (SELECT 1 ${openF} AND f.cd_controle = r.cd_controle)`} ORDER BY r.cd_flremessa`, 'cd_flremessa'],
      raw_itens: [`SELECT TOP ${limit} e.*,
          ISNULL((SELECT SUM(d.qt_devolucao) FROM fl_dev_equ d WITH (NOLOCK) WHERE d.cd_flremequ = e.cd_flremequ),0) AS qt_devolvida_calc,
          (SELECT MAX(COALESCE(dv.dt_devolucao, dv.dt_entrada)) FROM fl_dev_equ d WITH (NOLOCK)
            JOIN fl_devolucao dv WITH (NOLOCK) ON dv.cd_fldevolucao = d.cd_fldevolucao WHERE d.cd_flremequ = e.cd_flremequ) AS dt_retirada_calc,
          q.nm_equipto AS nm_equipto_calc, pt.nr_patrimonio AS nr_patrimonio_calc
        FROM fl_rem_equ e WITH (NOLOCK) JOIN fl_remessa r WITH (NOLOCK) ON r.cd_flremessa = e.cd_flremessa
        LEFT JOIN equipto q WITH (NOLOCK) ON q.cd_equipto = e.cd_equipto
        LEFT JOIN patrimon pt WITH (NOLOCK) ON pt.cd_patrimonio = e.cd_patrimonio
        WHERE r.fl_rem_cancelada = 'N' AND e.cd_flremequ > ${after}${remIds ? ` AND e.cd_flremessa IN (${remIds})` : ''}
          AND ${inCtrl || `EXISTS (SELECT 1 ${openF} AND f.cd_controle = r.cd_controle)`} ORDER BY e.cd_flremequ`, 'cd_flremequ'],
      raw_faturas: [`SELECT TOP ${limit} ft.* FROM fl_fatura ft WITH (NOLOCK) WHERE ft.cd_flfatura > ${after}
        AND EXISTS (SELECT 1 ${openF} AND f.cd_controle = ft.cd_controle) ORDER BY ft.cd_flfatura`, 'cd_flfatura'],
    };
    RAW.fichas = [`SELECT TOP ${limit}
        f.cd_controle, f.numero_prefixo, f.numero, f.numero_sufixo, f.cd_empresa, f.cd_empresa_mov,
        f.cd_pessoa, p.nm_pessoa, p.nm_fan_pessoa, f.cd_pessoa_fun, pfun.nm_pessoa AS nm_atendente,
        f.dt_pedido, f.dt_aprovacao, f.dt_fai_ficha, f.dt_faf_ficha, f.dt_prevista_devolucao,
        f.dt_min_devolucao, f.dt_fau_ficha, f.dt_fat_ficha, f.dt_prox_reajuste,
        f.cd_calcfat, cf.ds_calcfat, f.cd_atividade, a.ds_atividade, f.cd_regiao, rg.nm_regiao,
        f.cd_tpcontrato, f.cd_condpagto, f.cd_tipocob, f.cd_tab_preco, f.cd_projeto, f.cd_cr,
        f.vl_minimo_locacao, f.vl_preco_dia, f.vl_projeto, f.nr_periodos,
        f.nm_entrega, f.en_entrega, f.num_entrega, f.comp_entrega, f.br_entrega, f.ci_entrega,
        f.uf_entrega, f.cp_entrega, f.cnpj_entrega, f.contato, f.telefone, f.observacao
      FROM (SELECT TOP ${limit} f.* FROM fich_loc f WITH (NOLOCK)
        WHERE ${ABERTA}${emp} AND f.cd_controle > ${after} ORDER BY f.cd_controle) f
      LEFT JOIN pessoa p WITH (NOLOCK) ON p.cd_pessoa = f.cd_pessoa
      LEFT JOIN pessoa pfun WITH (NOLOCK) ON pfun.cd_pessoa = f.cd_pessoa_fun
      LEFT JOIN atividade a WITH (NOLOCK) ON a.cd_atividade = f.cd_atividade
      LEFT JOIN regiao rg WITH (NOLOCK) ON rg.cd_regiao = f.cd_regiao
      LEFT JOIN calcfat cf WITH (NOLOCK) ON cf.cd_calcfat = f.cd_calcfat
      ORDER BY f.cd_controle`, 'cd_controle'];
    if (body.mode === 'faturas_mensal') {
      // Faturamento por geração de faturas (Sisloc): fl_fatura por dt_geracao, todas as fichas, uma linha por fatura.
      const ds = String(body.start || '').match(/^\d{4}-\d{2}-\d{2}$/)?.[0];
      const de = String(body.end || '').match(/^\d{4}-\d{2}-\d{2}$/)?.[0];
      if (!ds || !de) return Response.json({ error: 'start/end obrigatórios' }, { status: 400 });
      const sqlFat = `SELECT YEAR(ft.dt_geracao) AS ano, MONTH(ft.dt_geracao) AS mes, f.cd_empresa,
          SUM(ISNULL(ft.vl_fatura,0)) AS valor, COUNT(*) AS faturas
        FROM fl_fatura ft WITH (NOLOCK) JOIN fich_loc f WITH (NOLOCK) ON f.cd_controle = ft.cd_controle
        WHERE ft.dt_geracao >= '${ds}' AND ft.dt_geracao < DATEADD(day, 1, '${de}')${emp}
        GROUP BY YEAR(ft.dt_geracao), MONTH(ft.dt_geracao), f.cd_empresa`;
      return Response.json({ rows: rowsOf(await execRead(source, sqlFat, DB_TIMEOUT)) });
    }
    if (body.mode === 'resumo') {
      // Totais dos contratos abertos: fichas, clientes e valor mensal de locação dos bens em posse.
      // Valor mensal = última fatura de locação (não complementar) gerada para cada ficha aberta.
      const sqlRes = `SELECT COUNT(*) AS fichas, COUNT(DISTINCT f.cd_pessoa) AS clientes, SUM(ISNULL(v.vl,0)) AS valor,
          SUM(CASE WHEN v.vl IS NULL THEN 1 ELSE 0 END) AS sem_fatura
        FROM fich_loc f WITH (NOLOCK)
        OUTER APPLY (SELECT TOP 1 ft.vl_fatura AS vl FROM fl_fatura ft WITH (NOLOCK)
          WHERE ft.cd_controle = f.cd_controle AND ISNULL(ft.fatura_complementar,'N') <> 'S'
          ORDER BY ft.dt_geracao DESC, ft.cd_flfatura DESC) v
        WHERE ${ABERTA}${emp}`;
      const r = rowsOf(await execRead(source, sqlRes, DB_TIMEOUT))[0] || {};
      return Response.json({ fichas: Number(r.fichas) || 0, clientes: Number(r.clientes) || 0, valor: Number(r.valor) || 0, sem_fatura: Number(r.sem_fatura) || 0 });
    }
    if (body.mode === 'sem_fatura') {
      // Mesmo critério do resumo: ficha aberta sem nenhuma fatura de locação não complementar.
      const sqlSem = `SELECT TOP 2000 f.cd_controle, f.numero_prefixo, f.numero, f.numero_sufixo, f.cd_empresa,
          f.cd_pessoa, p.nm_pessoa, f.dt_pedido, f.dt_aprovacao, f.dt_fai_ficha, f.dt_faf_ficha,
          f.vl_minimo_locacao, f.vl_preco_dia, f.ci_entrega, f.uf_entrega, f.contato, f.telefone,
          (SELECT MIN(r.dt_saida) FROM fl_remessa r WITH (NOLOCK) WHERE r.cd_controle = f.cd_controle AND r.fl_rem_cancelada = 'N') AS dt_primeira_saida
        FROM fich_loc f WITH (NOLOCK)
        LEFT JOIN pessoa p WITH (NOLOCK) ON p.cd_pessoa = f.cd_pessoa
        WHERE ${ABERTA}${emp} AND NOT EXISTS (SELECT 1 FROM fl_fatura ft WITH (NOLOCK)
          WHERE ft.cd_controle = f.cd_controle AND ISNULL(ft.fatura_complementar,'N') <> 'S')
        ORDER BY f.dt_fai_ficha`;
      const rows = rowsOf(await execRead(source, sqlSem, DB_TIMEOUT)).map((r: any) => {
        const o: any = {};
        for (const [k, v] of Object.entries(r)) o[k] = v instanceof Date ? iso(v) : (v != null && typeof v === 'object' ? null : v);
        return o;
      });
      return Response.json({ rows });
    }
    const renov = body.mode === 'renovacoes';
    const raw = RAW[body.mode];
    const key = raw ? raw[1] : renov ? 'cd_flfatura' : 'cd_flremequ';

    const rows = rowsOf(await execRead(source, raw ? raw[0] : renov ? sqlRenovF : sql, DB_TIMEOUT)).map((r: any) => {
      const o: any = {};
      for (const [k, v] of Object.entries(r)) o[k] = v instanceof Date ? iso(v) : (v != null && typeof v === 'object' ? null : v);
      return o;
    });
    const last = rows.length ? Number(rows[rows.length - 1][key]) : after;
    return Response.json({ rows, next_after: last, has_more: rows.length === limit });
  } catch (error) {
    return Response.json({ error: (error as Error).message || String(error) }, { status: 500 });
  }
});