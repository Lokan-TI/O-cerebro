import { canView } from '../../shared/access.ts';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { buildConfig, execRead } from '../../shared/erpConnection.ts';

// Padrão de locação por cliente (fonte Matriz): frequência, tendência e ciclo de fichas.
// Sem cd_pessoa = lista de clientes ativos; com cd_pessoa = detalhe do cliente.

const rowsOf = (res: any) => (res?.recordset || []);
const iso = (v: any) => (v instanceof Date ? v.toISOString().slice(0, 10) : v ?? null);
const clean = (rows: any[]) => rows.map((r) => {
  const o: any = {};
  for (const [k, v] of Object.entries(r)) o[k] = v instanceof Date ? iso(v) : v;
  return o;
});
const q = async (src: any, sql: string) => clean(rowsOf(await execRead(src, sql, 90000)));

const NF_OK = `nf.fl_ent_sai = 'S' AND ISNULL(CAST(nf.fl_can_nf AS varchar(5)),'N') NOT IN ('S','1') AND nf.dt_cancelamento IS NULL AND nf.dt_anul_nf IS NULL`;
const JOIN_EQ = `JOIN fl_remessa rem WITH (NOLOCK) ON rem.cd_controle = fl.cd_controle
  JOIN fl_rem_equ req WITH (NOLOCK) ON req.cd_flremessa = rem.cd_flremessa
  JOIN patrimon pat WITH (NOLOCK) ON pat.cd_patrimonio = req.cd_patrimonio
  JOIN equipto eq WITH (NOLOCK) ON eq.cd_equipto = pat.cd_equipto
  JOIN grupo WITH (NOLOCK) ON grupo.cd_grupo = eq.cd_grupo`;

function monthKey(d: Date) { return d.getFullYear() * 12 + d.getMonth(); }

async function lista(src: any, emp: number | null) {
  const fE = emp != null ? ` AND fl.cd_empresa = ${emp}` : '';
  const nE = emp != null ? ` AND nf.cd_empresa = ${emp}` : '';
  const ativos = await q(src, `SELECT nf.cd_pessoa, MAX(pes.nm_pessoa) AS nm_pessoa, SUM(ISNULL(nf.vl_faturamento,0)) AS vl_faturamento_12m, COUNT(DISTINCT nf.cd_nf) AS qtd_nfs_12m FROM nf WITH (NOLOCK) JOIN pessoa pes WITH (NOLOCK) ON pes.cd_pessoa = nf.cd_pessoa WHERE ${NF_OK} AND nf.dt_emi_nf >= DATEADD(MONTH, -12, GETDATE())${nE} GROUP BY nf.cd_pessoa`);
  const meses = await q(src, `SELECT fl.cd_pessoa, YEAR(fl.dt_pedido) AS ano, MONTH(fl.dt_pedido) AS mes, COUNT(*) AS qtd_fichas FROM fich_loc fl WITH (NOLOCK) WHERE fl.dt_pedido >= DATEADD(MONTH, -36, GETDATE()) AND fl.cd_pessoa IS NOT NULL AND ${NOT_ORC}${fE} GROUP BY fl.cd_pessoa, YEAR(fl.dt_pedido), MONTH(fl.dt_pedido)`);
  const ciclo = await q(src, `SELECT x.cd_pessoa, AVG(DATEDIFF(day, x.ficha_anterior, x.dt_pedido)) AS intervalo_medio_dias, COUNT(*) AS qtd_intervalos, MAX(x.dt_pedido) AS ultima_ficha FROM (SELECT fl.cd_pessoa, fl.dt_pedido, LAG(fl.dt_pedido) OVER (PARTITION BY fl.cd_pessoa ORDER BY fl.dt_pedido) AS ficha_anterior FROM fich_loc fl WITH (NOLOCK) WHERE fl.dt_pedido >= DATEADD(MONTH, -36, GETDATE()) AND fl.cd_pessoa IS NOT NULL AND ${NOT_ORC}${fE}) x WHERE x.ficha_anterior IS NOT NULL GROUP BY x.cd_pessoa`);
  const equip = await q(src, `SELECT fl.cd_pessoa, SUM(CASE WHEN ISNULL(req.qt_remessa,0) - ISNULL(req.qt_devolucao,0) > 0 THEN ISNULL(req.qt_remessa,0) - ISNULL(req.qt_devolucao,0) ELSE 0 END) AS equipamentos_no_cliente, COUNT(DISTINCT CASE WHEN ISNULL(req.qt_remessa,0) - ISNULL(req.qt_devolucao,0) > 0 THEN req.cd_patrimonio END) AS patrimonios_distintos FROM fich_loc fl WITH (NOLOCK) JOIN fl_remessa rem WITH (NOLOCK) ON rem.cd_controle = fl.cd_controle JOIN fl_rem_equ req WITH (NOLOCK) ON req.cd_flremessa = rem.cd_flremessa WHERE fl.dt_enc_ficha IS NULL AND fl.cd_pessoa IS NOT NULL AND ${NOT_ORC}${fE} GROUP BY fl.cd_pessoa`);
  const ult = await q(src, `SELECT fl.cd_pessoa, MAX(fl.dt_pedido) AS ultima_ficha, COUNT(*) AS fichas_total FROM fich_loc fl WITH (NOLOCK) WHERE fl.dt_pedido >= DATEADD(MONTH, -36, GETDATE()) AND fl.cd_pessoa IS NOT NULL AND ${NOT_ORC}${fE} GROUP BY fl.cd_pessoa`);
  const ultBy = new Map(ult.map((u) => [String(u.cd_pessoa), u.ultima_ficha]));

  const now = new Date();
  const cur = monthKey(now);
  const mesBy = new Map<string, any[]>();
  for (const m of meses) { const k = String(m.cd_pessoa); (mesBy.get(k) || mesBy.set(k, []).get(k)!).push(m); }
  const cicloBy = new Map(ciclo.map((c) => [String(c.cd_pessoa), c]));
  const equipBy = new Map(equip.map((e) => [String(e.cd_pessoa), e]));

  return ativos.map((a) => {
    const k = String(a.cd_pessoa);
    const ms = mesBy.get(k) || [];
    let total = 0, ult3 = 0, ant3 = 0;
    for (const m of ms) {
      const n = Number(m.qtd_fichas) || 0;
      total += n;
      const age = cur - (Number(m.ano) * 12 + Number(m.mes) - 1);
      if (age >= 0 && age < 3) ult3 += n; else if (age >= 3 && age < 6) ant3 += n;
    }
    const c: any = cicloBy.get(k) || {};
    const e: any = equipBy.get(k) || {};
    const ultima = ultBy.get(k) || null;
    const dias = ultima ? Math.floor((now.getTime() - new Date(ultima).getTime()) / 86400000) : null;
    const intervalo = c.intervalo_medio_dias != null ? Number(c.intervalo_medio_dias) : null;
    const qi = Number(c.qtd_intervalos) || 0;

    let tendencia = 'ESTAVEL';
    if (ult3 === 0 && ant3 === 0) tendencia = 'SEM_FICHAS_RECENTES';
    else if (ant3 === 0) tendencia = 'NOVO_PADRAO';
    else if (ult3 < ant3 * 0.8) tendencia = 'DECRESCENTE';
    else if (ult3 > ant3 * 1.2) tendencia = 'CRESCENTE';

    let ciclo_status = 'SEM_PADRAO_RECORRENTE';
    if (qi >= 3 && intervalo != null && dias != null) {
      ciclo_status = dias >= intervalo ? 'CICLO_VENCIDO' : dias >= intervalo * 0.75 ? 'APROXIMANDO_CICLO' : 'DENTRO_DO_CICLO';
    }

    return {
      cd_pessoa: a.cd_pessoa, nm_pessoa: a.nm_pessoa,
      vl_faturamento_12m: Number(a.vl_faturamento_12m) || 0, qtd_nfs_12m: Number(a.qtd_nfs_12m) || 0,
      fichas_total_36m: total, media_fichas_mes: Math.round((total / 36) * 100) / 100,
      equipamentos_no_cliente: Number(e.equipamentos_no_cliente) || 0, patrimonios_distintos: Number(e.patrimonios_distintos) || 0,
      ultima_ficha: ultima, dias_desde_ultima: dias, intervalo_medio_dias: intervalo, qtd_intervalos: qi,
      tendencia, ciclo_status,
      oportunidade_comercial: ciclo_status === 'CICLO_VENCIDO' || ciclo_status === 'APROXIMANDO_CICLO' || tendencia === 'DECRESCENTE',
      fichas_ultimos_3m: ult3, fichas_3m_anteriores: ant3,
    };
  });
}

// Orçamentos (tp_ope_pedido = 'O') não são locações reais — excluídos de todas as métricas de ficha.
const NOT_ORC = `ISNULL(fl.tp_ope_pedido,'') <> 'O'`;

async function detalhe(src: any, cd: number, emp: number | null) {
  const fE = emp != null ? ` AND fl.cd_empresa = ${emp}` : '';
  const fichas = await q(src, `SELECT TOP 200 fl.cd_controle, fl.numero AS numero_ficha, fl.dt_pedido, fl.dt_fai_ficha, fl.dt_faf_ficha, fl.dt_enc_ficha, fl.cd_tpcontrato, fl.cd_calcfat, fl.cd_pessoa_cap, MAX(fl.tp_ope_pedido) AS tp_ope_pedido, MAX(pes.nm_pessoa) AS nm_captador, COUNT(DISTINCT req.cd_patrimonio) AS itens_remessados, SUM(ISNULL(req.qt_remessa,0) - ISNULL(req.qt_devolucao,0)) AS saldo_no_cliente FROM fich_loc fl WITH (NOLOCK) LEFT JOIN pessoa pes WITH (NOLOCK) ON pes.cd_pessoa = fl.cd_pessoa_cap LEFT JOIN fl_remessa rem WITH (NOLOCK) ON rem.cd_controle = fl.cd_controle LEFT JOIN fl_rem_equ req WITH (NOLOCK) ON req.cd_flremessa = rem.cd_flremessa WHERE fl.cd_pessoa = ${cd}${fE} AND fl.dt_pedido >= DATEADD(MONTH, -36, GETDATE()) GROUP BY fl.cd_controle, fl.numero, fl.dt_pedido, fl.dt_fai_ficha, fl.dt_faf_ficha, fl.dt_enc_ficha, fl.cd_tpcontrato, fl.cd_calcfat, fl.cd_pessoa_cap ORDER BY fl.dt_pedido DESC`);
  const heatmap_mensal = await q(src, `SELECT YEAR(fl.dt_pedido) AS ano, MONTH(fl.dt_pedido) AS mes, COUNT(*) AS qtd_fichas FROM fich_loc fl WITH (NOLOCK) WHERE fl.cd_pessoa = ${cd}${fE} AND ${NOT_ORC} AND fl.dt_pedido >= DATEADD(MONTH, -36, GETDATE()) GROUP BY YEAR(fl.dt_pedido), MONTH(fl.dt_pedido) ORDER BY ano, mes`);
  const grupos_mais_locados = await q(src, `SELECT grupo.cd_grupo, grupo.nm_grupo, SUM(ISNULL(req.qt_remessa,0)) AS itens_enviados, SUM(ISNULL(req.qt_remessa,0) - ISNULL(req.qt_devolucao,0)) AS saldo_atual FROM fich_loc fl WITH (NOLOCK) ${JOIN_EQ} WHERE fl.cd_pessoa = ${cd}${fE} GROUP BY grupo.cd_grupo, grupo.nm_grupo ORDER BY itens_enviados DESC`);
  const equipamentos_ativos = await q(src, `SELECT TOP 300 fl.cd_controle, fl.numero AS numero_ficha, req.cd_patrimonio, grupo.nm_grupo, eq.ds_descricaocomercial, ISNULL(req.qt_remessa,0) - ISNULL(req.qt_devolucao,0) AS saldo FROM fich_loc fl WITH (NOLOCK) ${JOIN_EQ} WHERE fl.cd_pessoa = ${cd}${fE} AND fl.dt_enc_ficha IS NULL AND ISNULL(req.qt_remessa,0) - ISNULL(req.qt_devolucao,0) > 0 ORDER BY grupo.nm_grupo`);
  return { fichas, heatmap_mensal, grupos_mais_locados, equipamentos_ativos };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!canView(user)) return Response.json({ error: 'Acesso restrito.' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const emp = body?.cd_empresa != null && body.cd_empresa !== '' ? Number(body.cd_empresa) : null;
    if (emp != null && !Number.isInteger(emp)) return Response.json({ error: 'cd_empresa inválido.' }, { status: 400 });
    const [src] = await base44.asServiceRole.entities.ErpDataSource.filter({ name: 'Matriz' });
    if (!src || !buildConfig(src)) return Response.json({ error: 'Fonte "Matriz" não configurada.' }, { status: 400 });

    if (body?.cd_pessoa != null && body.cd_pessoa !== '') {
      const cd = Number(body.cd_pessoa);
      if (!Number.isInteger(cd)) return Response.json({ error: 'cd_pessoa inválido.' }, { status: 400 });
      return Response.json(await detalhe(src, cd, emp));
    }
    return Response.json({ rows: await lista(src, emp) });
  } catch (error) {
    return Response.json({ error: (error as Error).message || String(error) }, { status: 500 });
  }
});