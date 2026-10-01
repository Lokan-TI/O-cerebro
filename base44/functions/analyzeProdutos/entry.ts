import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { buildConfig, runQuery, closePool } from '../../shared/erpConnection.ts';

// Análise de produtos em partes (para não estourar timeout do ERP):
// catalogo | saldos | ativos | manutencao
const SQL: Record<string, { label: string; description: string; sql: string }> = {
  catalogo: {
    label: 'Catálogo de produtos',
    description: 'equipto + grupo — todos os grupos',
    sql: `SELECT q.cd_equipto, q.nm_equipto, q.codigo, q.fl_ativo, q.cd_grupo, g.nm_grupo,
        q.vl_aqu_equipto, q.vl_base_locacao, q.vl_venda_usado
      FROM equipto q WITH (NOLOCK)
      LEFT JOIN grupo g WITH (NOLOCK) ON g.cd_grupo = q.cd_grupo`,
  },
  saldos: {
    label: 'Saldo atual de estoque',
    description: 'est_movitem — último movimento de cada produto (qt_saldo_atual e custo médio)',
    sql: `SELECT u.cd_equipto, u.qt_saldo_atual, u.vl_custo_medio FROM (
        SELECT m.cd_equipto, m.qt_saldo_atual, m.vl_custo_medio,
          ROW_NUMBER() OVER (PARTITION BY m.cd_equipto ORDER BY m.dt_mov DESC, m.cd_movitem DESC) AS rn
        FROM est_movitem m WITH (NOLOCK)) u WHERE u.rn = 1`,
  },
  ativos: {
    label: 'Patrimônios, locações e receita estimada',
    description: 'patrimon + fl_rem_equ/fl_remessa/fl_devolucao — receita = valor mensal × dias locados / 30',
    sql: `SELECT pt.cd_patrimonio, pt.nr_patrimonio, pt.nr_serie, pt.cd_equipto, pt.cd_empresa,
        pt.vl_aqu_patrimonio, CONVERT(char(10), pt.dt_aqu_patrimonio, 120) AS dt_aquisicao, pt.fl_vendido,
        l.qtd_locacoes, l.dias_locados, l.receita, l.em_locacao, l.cliente_atual, l.contrato_atual,
        CONVERT(char(10), l.ultima_saida, 120) AS ultima_saida
      FROM patrimon pt WITH (NOLOCK)
      LEFT JOIN (
        SELECT e.cd_patrimonio, COUNT(*) AS qtd_locacoes,
          SUM(CASE WHEN x.dias > 0 THEN x.dias ELSE 0 END) AS dias_locados,
          SUM(CASE WHEN x.dias > 0 THEN COALESCE(e.vl_uni_locacao, 0) * x.dias / 30.0 ELSE 0 END) AS receita,
          MAX(CASE WHEN d.cd_fldevolucao IS NULL THEN 1 ELSE 0 END) AS em_locacao,
          MAX(CASE WHEN d.cd_fldevolucao IS NULL THEN p.nm_pessoa END) AS cliente_atual,
          MAX(CASE WHEN d.cd_fldevolucao IS NULL THEN r.nr_contrato END) AS contrato_atual,
          MAX(r.dt_saida) AS ultima_saida
        FROM fl_rem_equ e WITH (NOLOCK)
        JOIN fl_remessa r WITH (NOLOCK) ON r.cd_flremessa = e.cd_flremessa
        LEFT JOIN fich_loc f WITH (NOLOCK) ON f.cd_controle = r.cd_controle
        LEFT JOIN pessoa p WITH (NOLOCK) ON p.cd_pessoa = f.cd_pessoa
        LEFT JOIN fl_dev_equ de WITH (NOLOCK) ON de.cd_flremequ = e.cd_flremequ
        LEFT JOIN fl_devolucao d WITH (NOLOCK) ON d.cd_fldevolucao = de.cd_fldevolucao
        CROSS APPLY (SELECT DATEDIFF(day, r.dt_saida, COALESCE(d.dt_devolucao, GETDATE())) AS dias) x
        WHERE e.cd_patrimonio IS NOT NULL
        GROUP BY e.cd_patrimonio
      ) l ON l.cd_patrimonio = pt.cd_patrimonio`,
  },
  manutencao: {
    label: 'Custo de manutenção por patrimônio',
    description: 'orcos — material + serviço + terceiros, equipamentos próprios, histórico completo',
    sql: `SELECT o.cd_patrimonio, COUNT(*) AS qtd_os,
        SUM(COALESCE(o.vl_custoos_material, 0)) AS material,
        SUM(COALESCE(o.vl_custoos_servico, 0)) AS servico,
        SUM(COALESCE(o.vl_custoos_terceiro, 0)) AS terceiro,
        CONVERT(char(10), MAX(o.dt_abertura), 120) AS ultima_os
      FROM orcos o WITH (NOLOCK)
      WHERE o.cd_patrimonio IS NOT NULL AND UPPER(COALESCE(o.fl_propriedade, 'P')) = 'P'
      GROUP BY o.cd_patrimonio`,
  },
};

const n = (v: any) => Number(v || 0);

const shape: Record<string, (r: any) => any> = {
  catalogo: (r) => ({
    cd_equipto: n(r.cd_equipto), nm_equipto: String(r.nm_equipto || '').trim(), codigo: String(r.codigo || ''),
    ativo: String(r.fl_ativo || '').toUpperCase() === 'S', cd_grupo: n(r.cd_grupo), grupo: String(r.nm_grupo || '(sem grupo)'),
    vl_compra: n(r.vl_aqu_equipto), vl_base_locacao: n(r.vl_base_locacao), vl_venda_usado: n(r.vl_venda_usado),
  }),
  saldos: (r) => ({ cd_equipto: n(r.cd_equipto), saldo: n(r.qt_saldo_atual), custo_medio: n(r.vl_custo_medio) }),
  ativos: (r) => ({
    cd_patrimonio: n(r.cd_patrimonio), nr_patrimonio: String(r.nr_patrimonio || r.cd_patrimonio || ''),
    nr_serie: String(r.nr_serie || ''), cd_equipto: n(r.cd_equipto), cd_empresa: r.cd_empresa == null ? '' : String(r.cd_empresa),
    vl_aquisicao: n(r.vl_aqu_patrimonio), dt_aquisicao: r.dt_aquisicao ? String(r.dt_aquisicao).slice(0, 10) : null,
    vendido: String(r.fl_vendido || '').toUpperCase() === 'S', qtd_locacoes: n(r.qtd_locacoes), dias_locados: n(r.dias_locados),
    receita: n(r.receita), em_locacao: n(r.em_locacao) === 1, cliente_atual: String(r.cliente_atual || ''),
    contrato_atual: String(r.contrato_atual || ''), ultima_saida: r.ultima_saida ? String(r.ultima_saida).slice(0, 10) : null,
  }),
  manutencao: (r) => ({
    cd_patrimonio: n(r.cd_patrimonio), qtd_os: n(r.qtd_os), material: n(r.material), servico: n(r.servico),
    terceiro: n(r.terceiro), custo: n(r.material) + n(r.servico) + n(r.terceiro),
    ultima_os: r.ultima_os ? String(r.ultima_os).slice(0, 10) : null,
  }),
};

Deno.serve(async (req) => {
  const body = await req.json().catch(() => ({}));
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const part = String(body?.part || '');
    const def = SQL[part];
    if (!def) return Response.json({ error: 'Parâmetro "part" inválido.' }, { status: 400 });

    let source: any = { credential_reference: 'env' };
    if (body?.source_id) {
      source = await base44.asServiceRole.entities.ErpDataSource.get(body.source_id);
      if (!source || source.is_active === false) return Response.json({ error: 'Fonte de dados indisponível.' }, { status: 404 });
    }
    const built = buildConfig(source);
    if (!built) return Response.json({ error: 'Configuração de conexão incompleta.' }, { status: 500 });
    const sql = built.clientId ? `EXEC DW_API '${built.clientId}', '${def.sql.replace(/'/g, "''")}'` : def.sql;

    const res: any = await runQuery(source, sql, 90000);
    const rows = (res?.recordset || []).map(shape[part]);
    return Response.json({ part, rows, query: { label: def.label, description: def.description, sql: def.sql } });
  } catch (error) {
    try {
      if (body?.source_id) await closePool({ id: body.source_id, credential_reference: 'entity' });
      else await closePool({ credential_reference: 'env' });
    } catch {}
    return Response.json({ error: (error as Error)?.message || String(error) }, { status: 500 });
  }
});