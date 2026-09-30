import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { buildConfig, execRead } from '../../shared/erpConnection.ts';

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
const ABERTA = `f.dt_enc_ficha IS NULL AND f.dt_suspensao IS NULL AND f.tp_ope_pedido <> 'O'`;

const iso = (v: any) => {
  if (!v || !(v instanceof Date) && typeof v !== 'string') return v ?? null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Apenas administradores.' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const source = await base44.asServiceRole.entities.ErpDataSource.get(body.source_id);
    if (!source || !buildConfig(source)) return Response.json({ error: 'Fonte de dados inválida.' }, { status: 400 });

    const after = Math.max(0, Number(body.after) || 0);
    const limit = Math.min(1500, Math.max(100, Number(body.limit) || 1000));
    const emp = body.cd_empresa != null && body.cd_empresa !== '' ? ` AND f.cd_empresa = ${Number(body.cd_empresa)}` : '';

    const sql = `SELECT TOP ${limit}
        f.cd_controle, f.numero_prefixo, f.numero, f.numero_sufixo, f.cd_empresa, f.cd_empresa_mov,
        f.cd_pessoa, p.nm_pessoa, p.nm_fan_pessoa,
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
        e.cd_patrimonio, q.cd_grupo, e.qt_remessa,
        ISNULL((SELECT SUM(d.qt_devolucao) FROM fl_dev_equ d WITH (NOLOCK) WHERE d.cd_flremequ = e.cd_flremequ),0) AS qt_devolvida,
        e.vl_uni_locacao, e.vl_uni_diaria, e.vl_uni_tabela, e.vl_uni_indenizacao, e.vl_nf,
        e.ds_latitude, e.ds_longitude
      FROM fich_loc f WITH (NOLOCK)
      JOIN fl_remessa r WITH (NOLOCK) ON r.cd_controle = f.cd_controle
      JOIN fl_rem_equ e WITH (NOLOCK) ON e.cd_flremessa = r.cd_flremessa
      LEFT JOIN pessoa p WITH (NOLOCK) ON p.cd_pessoa = f.cd_pessoa
      LEFT JOIN equipto q WITH (NOLOCK) ON q.cd_equipto = e.cd_equipto
      LEFT JOIN atividade a WITH (NOLOCK) ON a.cd_atividade = f.cd_atividade
      LEFT JOIN regiao rg WITH (NOLOCK) ON rg.cd_regiao = f.cd_regiao
      LEFT JOIN calcfat cf WITH (NOLOCK) ON cf.cd_calcfat = f.cd_calcfat
      WHERE ${ABERTA}
        AND r.fl_rem_cancelada = 'N'
        AND e.qt_remessa > ISNULL((SELECT SUM(d.qt_devolucao) FROM fl_dev_equ d WITH (NOLOCK) WHERE d.cd_flremequ = e.cd_flremequ),0)
        AND e.cd_flremequ > ${after}${emp}
      ORDER BY e.cd_flremequ`;

    const sqlRenov = `SELECT TOP ${limit}
        ft.cd_flfatura, ft.cd_controle, f.numero_prefixo, f.numero, f.numero_sufixo, f.cd_empresa,
        f.cd_pessoa, p.nm_pessoa, ft.dt_geracao, ft.dt_inicio, ft.dt_fim, ft.dt_fim_ajuste,
        ft.vl_fatura, ft.vl_minimo_locacao, ft.fatura_complementar, ft.cd_nf
      FROM fl_fatura ft WITH (NOLOCK)
      JOIN fich_loc f WITH (NOLOCK) ON f.cd_controle = ft.cd_controle
      LEFT JOIN pessoa p WITH (NOLOCK) ON p.cd_pessoa = f.cd_pessoa
      WHERE ${ABERTA} AND ft.cd_flfatura > ${after}${emp}
      ORDER BY ft.cd_flfatura`;
    // Modos brutos: todas as colunas originais de cada tabela, sem simplificação
    const openF = `FROM fich_loc f WITH (NOLOCK) WHERE ${ABERTA}${emp}`;
    const RAW: Record<string, [string, string]> = {
      raw_fichas: [`SELECT TOP ${limit} f.* ${openF} AND f.cd_controle > ${after} ORDER BY f.cd_controle`, 'cd_controle'],
      raw_pessoas: [`SELECT TOP ${limit} p.* FROM pessoa p WITH (NOLOCK) WHERE p.cd_pessoa > ${after}
        AND EXISTS (SELECT 1 ${openF} AND f.cd_pessoa = p.cd_pessoa) ORDER BY p.cd_pessoa`, 'cd_pessoa'],
      raw_remessas: [`SELECT TOP ${limit} r.* FROM fl_remessa r WITH (NOLOCK) WHERE r.fl_rem_cancelada = 'N' AND r.cd_flremessa > ${after}
        AND EXISTS (SELECT 1 ${openF} AND f.cd_controle = r.cd_controle) ORDER BY r.cd_flremessa`, 'cd_flremessa'],
      raw_itens: [`SELECT TOP ${limit} e.*,
          ISNULL((SELECT SUM(d.qt_devolucao) FROM fl_dev_equ d WITH (NOLOCK) WHERE d.cd_flremequ = e.cd_flremequ),0) AS qt_devolvida_calc
        FROM fl_rem_equ e WITH (NOLOCK) JOIN fl_remessa r WITH (NOLOCK) ON r.cd_flremessa = e.cd_flremessa
        WHERE r.fl_rem_cancelada = 'N' AND e.cd_flremequ > ${after}
          AND EXISTS (SELECT 1 ${openF} AND f.cd_controle = r.cd_controle) ORDER BY e.cd_flremequ`, 'cd_flremequ'],
      raw_faturas: [`SELECT TOP ${limit} ft.* FROM fl_fatura ft WITH (NOLOCK) WHERE ft.cd_flfatura > ${after}
        AND EXISTS (SELECT 1 ${openF} AND f.cd_controle = ft.cd_controle) ORDER BY ft.cd_flfatura`, 'cd_flfatura'],
    };
    RAW.fichas = [`SELECT TOP ${limit}
        f.cd_controle, f.numero_prefixo, f.numero, f.numero_sufixo, f.cd_empresa, f.cd_empresa_mov,
        f.cd_pessoa, p.nm_pessoa, p.nm_fan_pessoa,
        f.dt_pedido, f.dt_aprovacao, f.dt_fai_ficha, f.dt_faf_ficha, f.dt_prevista_devolucao,
        f.dt_min_devolucao, f.dt_fau_ficha, f.dt_fat_ficha, f.dt_prox_reajuste,
        f.cd_calcfat, cf.ds_calcfat, f.cd_atividade, a.ds_atividade, f.cd_regiao, rg.nm_regiao,
        f.cd_tpcontrato, f.cd_condpagto, f.cd_tipocob, f.cd_tab_preco, f.cd_projeto, f.cd_cr,
        f.vl_minimo_locacao, f.vl_preco_dia, f.vl_projeto, f.nr_periodos,
        f.nm_entrega, f.en_entrega, f.num_entrega, f.comp_entrega, f.br_entrega, f.ci_entrega,
        f.uf_entrega, f.cp_entrega, f.cnpj_entrega, f.contato, f.telefone, f.observacao
      FROM fich_loc f WITH (NOLOCK)
      LEFT JOIN pessoa p WITH (NOLOCK) ON p.cd_pessoa = f.cd_pessoa
      LEFT JOIN atividade a WITH (NOLOCK) ON a.cd_atividade = f.cd_atividade
      LEFT JOIN regiao rg WITH (NOLOCK) ON rg.cd_regiao = f.cd_regiao
      LEFT JOIN calcfat cf WITH (NOLOCK) ON cf.cd_calcfat = f.cd_calcfat
      WHERE ${ABERTA}${emp} AND f.cd_controle > ${after}
      ORDER BY f.cd_controle`, 'cd_controle'];
    const renov = body.mode === 'renovacoes';
    const raw = RAW[body.mode];
    const key = raw ? raw[1] : renov ? 'cd_flfatura' : 'cd_flremequ';

    const rows = rowsOf(await execRead(source, raw ? raw[0] : renov ? sqlRenov : sql, 90000)).map((r: any) => {
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