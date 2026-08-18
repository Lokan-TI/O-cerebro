import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { execRead } from '../../shared/erpConnection.ts';

// Balancete / DRE de caixa a partir do plano financeiro do Sisloc.
// Plano financeiro = 9 dígitos em 4 níveis: 1 (G) · 2 (GG) · 4 (GGBB) · 9 (analítica).
// Regime: baixa (caixa) · vencimento · emissao · competencia (lanca.dt_competencia).
const rowsOf = (result: any): any[] => {
  if (Array.isArray(result?.recordset) && result.recordset.length > 0) return result.recordset;
  if (Array.isArray(result?.recordsets)) {
    for (let i = result.recordsets.length - 1; i >= 0; i--) {
      const rs = result.recordsets[i];
      if (Array.isArray(rs) && rs.length > 0) return rs;
    }
  }
  return [];
};

const num = (v: unknown) => Number(v || 0);

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const end = String(body?.end_date || new Date().toISOString().slice(0, 10));
    const start = String(
      body?.start_date || new Date(new Date(end).getTime() - 365 * 86400000).toISOString().slice(0, 10),
    );
    const regime = ['baixa', 'vencimento', 'emissao', 'competencia'].includes(String(body?.regime))
      ? String(body.regime)
      : 'baixa';

    let source: Record<string, unknown> = { credential_reference: 'env' };
    if (body?.source_id) {
      source = await base44.asServiceRole.entities.ErpDataSource.get(body.source_id);
      if (!source) return Response.json({ error: 'Fonte de dados não encontrada.' }, { status: 404 });
    }

    const dateCol = (t: 'cap' | 'car') => {
      if (regime === 'vencimento') return `c.dt_ven_${t}`;
      if (regime === 'emissao') return `c.dt_emi_${t}`;
      if (regime === 'competencia') return 'l.dt_competencia';
      return `c.dt_bai_${t}`;
    };

    const joinLanca = regime === 'competencia' ? 'LEFT JOIN lanca l WITH (NOLOCK) ON l.cd_lan = c.cd_lan' : '';
    const window = (t: 'cap' | 'car') =>
      `${dateCol(t)} >= '${start}' AND ${dateCol(t)} < DATEADD(day, 1, CAST('${end}' AS date))`;

    const valCap = 'ROUND(COALESCE(c.vl_pre_cap,0)+COALESCE(c.vl_acr_cap,0)-COALESCE(c.vl_des_cap,0),2)';
    const valCar = 'ROUND(COALESCE(c.vl_pre_car,0)+COALESCE(c.vl_acr_car,0)-COALESCE(c.vl_des_car,0),2)';

    const sqlPlano = `SELECT LTRIM(RTRIM(nr_planfin)) AS nr, LTRIM(RTRIM(COALESCE(ds_planfin,''))) AS ds,
        LTRIM(RTRIM(COALESCE(fl_planfin,''))) AS fl
      FROM plano WITH (NOLOCK)
      WHERE nr_planfin IS NOT NULL
      ORDER BY LTRIM(RTRIM(nr_planfin))`;

    const sqlSaidas = `SELECT LTRIM(RTRIM(COALESCE(pl.nr_planfin,''))) AS nr,
        COALESCE(NULLIF(LTRIM(RTRIM(pl.ds_planfin)),''),'Sem conta vinculada') AS ds,
        COUNT(*) AS qtd, SUM(${valCap}) AS valor
      FROM cap c WITH (NOLOCK)
      LEFT JOIN plano pl WITH (NOLOCK) ON pl.cd_planfin = c.cd_conta
      ${joinLanca}
      WHERE ${window('cap')} AND c.fl_status_titulo <> 40
      GROUP BY pl.nr_planfin, pl.ds_planfin
      ORDER BY SUM(${valCap}) DESC`;

    const sqlEntradas = `SELECT LTRIM(RTRIM(COALESCE(pl.nr_planfin,''))) AS nr,
        COALESCE(NULLIF(LTRIM(RTRIM(pl.ds_planfin)),''),'Sem conta vinculada') AS ds,
        COUNT(*) AS qtd, SUM(${valCar}) AS valor
      FROM car c WITH (NOLOCK)
      LEFT JOIN plano pl WITH (NOLOCK) ON pl.cd_planfin = c.cd_conta
      ${joinLanca}
      WHERE ${window('car')} AND COALESCE(c.fl_status,0) <> 40
      GROUP BY pl.nr_planfin, pl.ds_planfin
      ORDER BY SUM(${valCar}) DESC`;

    const sqlMensal = `SELECT CONVERT(char(7), ${dateCol('cap')}, 126) AS mes,
        LEFT(LTRIM(RTRIM(COALESCE(pl.nr_planfin,'000000000'))), 2) AS n2,
        SUM(${valCap}) AS valor
      FROM cap c WITH (NOLOCK)
      LEFT JOIN plano pl WITH (NOLOCK) ON pl.cd_planfin = c.cd_conta
      ${joinLanca}
      WHERE ${window('cap')} AND c.fl_status_titulo <> 40
      GROUP BY CONVERT(char(7), ${dateCol('cap')}, 126), LEFT(LTRIM(RTRIM(COALESCE(pl.nr_planfin,'000000000'))), 2)
      ORDER BY 1`;

    const sqlFornecedores = `SELECT TOP 40 COALESCE(NULLIF(LTRIM(RTRIM(p.nm_pessoa)),''),'(sem fornecedor)') AS fornecedor,
        LEFT(LTRIM(RTRIM(COALESCE(pl.nr_planfin,'000000000'))), 4) AS n3,
        COUNT(*) AS qtd, SUM(${valCap}) AS valor
      FROM cap c WITH (NOLOCK)
      LEFT JOIN pessoa p WITH (NOLOCK) ON p.cd_pessoa = c.cd_pessoa_cre
      LEFT JOIN plano pl WITH (NOLOCK) ON pl.cd_planfin = c.cd_conta
      ${joinLanca}
      WHERE ${window('cap')} AND c.fl_status_titulo <> 40
        AND LEFT(LTRIM(RTRIM(COALESCE(pl.nr_planfin,'000000000'))), 1) <> '1'
        AND LEFT(LTRIM(RTRIM(COALESCE(pl.nr_planfin,'000000000'))), 2) <> '29'
      GROUP BY p.nm_pessoa, LEFT(LTRIM(RTRIM(COALESCE(pl.nr_planfin,'000000000'))), 4)
      ORDER BY SUM(${valCap}) DESC`;

    const warnings: string[] = [];
    const t0 = Date.now();
    // Orçamento total de 70s: cada consulta tem 15s e, se o tempo acabar, as
    // restantes são puladas com aviso em vez de deixar a página girando.
    const BUDGET_MS = 70000;
    const run = async (label: string, sql: string, ms = 15000) => {
      if (Date.now() - t0 > BUDGET_MS) {
        warnings.push(`${label}: não executada — tempo limite da página atingido.`);
        return [];
      }
      try {
        return rowsOf(await execRead(source, sql, ms));
      } catch (e) {
        warnings.push(`${label}: ${(e as Error)?.message || String(e)}`);
        return [];
      }
    };

    const plano = await run('Plano financeiro', sqlPlano, 30000);
    const saidas = await run('Saídas por conta', sqlSaidas);
    const entradas = await run('Entradas por conta', sqlEntradas);
    const mensal = await run('Série mensal', sqlMensal);
    const fornecedores = await run('Fornecedores', sqlFornecedores);

    const mapConta = (r: any) => ({
      nr: String(r.nr || ''),
      ds: String(r.ds || ''),
      qtd: num(r.qtd),
      valor: num(r.valor),
    });

    return Response.json({
      generated_at: new Date().toISOString(),
      period: { start, end },
      regime,
      plano: plano.map((r: any) => ({ nr: String(r.nr || ''), ds: String(r.ds || ''), fl: String(r.fl || '') })),
      saidas: saidas.map(mapConta),
      entradas: entradas.map(mapConta),
      mensal: mensal.map((r: any) => ({ mes: String(r.mes || ''), n2: String(r.n2 || ''), valor: num(r.valor) })),
      fornecedores: fornecedores.map((r: any) => ({
        fornecedor: String(r.fornecedor || ''),
        n3: String(r.n3 || ''),
        qtd: num(r.qtd),
        valor: num(r.valor),
      })),
      warnings,
      duration_ms: Date.now() - t0,
      queries: [
        { label: 'Plano financeiro', description: 'plano — 4 níveis de natureza financeira', sql: sqlPlano },
        { label: 'Saídas por conta', description: `cap por conta do plano (regime ${regime})`, sql: sqlSaidas },
        { label: 'Entradas por conta', description: `car por conta do plano (regime ${regime})`, sql: sqlEntradas },
        { label: 'Série mensal de saídas', description: 'cap por mês e grupo de natureza', sql: sqlMensal },
        { label: 'Fornecedores', description: 'cap por fornecedor — concentração de saídas', sql: sqlFornecedores },
      ],
    });
  } catch (error) {
    return Response.json({ error: (error as Error)?.message || String(error) }, { status: 500 });
  }
}