import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { execRead } from '../../shared/erpConnection.ts';
import { resolvePeriod } from '../../shared/periodContract.ts';

// Análise de centros de custo (proxy = hierarquia do plano financeiro do Sisloc).
// As tabelas financas_centrocusto / rateio estão vazias na base, portanto a
// classificação de despesa vive no plano financeiro (nr_planfin de 9 dígitos):
//   2........ = Saídas · 21...... = grupo · 2101.... = bloco · analítica = conta.
// Status oficiais: 5=provisório · 10=aberto · 25/30=baixado · 40=cancelado.
function rows(result: Record<string, unknown>): unknown[] {
  if (Array.isArray(result?.recordset) && result.recordset.length > 0) return result.recordset;
  if (Array.isArray(result?.recordsets)) {
    for (let i = (result.recordsets as unknown[]).length - 1; i >= 0; i--) {
      const rs = (result.recordsets as unknown[][])[i];
      if (Array.isArray(rs) && rs.length > 0) return rs;
    }
  }
  return [];
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const resolvedPeriod = resolvePeriod({
      start: body?.start_date,
      endInclusive: body?.end_date,
      endExclusive: body?.end_date_exclusive,
      defaultStart: '2013-01-01',
      defaultEndInclusive: new Date().toISOString().slice(0, 10),
    });
    const startDate = resolvedPeriod.start;
    const endDate = resolvedPeriod.endInclusive;
    const endDateExclusive = resolvedPeriod.endExclusive;

    const val = `ROUND(COALESCE(c.vl_pre_cap, 0) + COALESCE(c.vl_acr_cap, 0) - COALESCE(c.vl_des_cap, 0), 2)`;
    const periodo = `c.dt_emi_cap >= '${startDate}' AND c.dt_emi_cap < '${endDateExclusive}'`; 

    // 1) Detalhe por conta analítica, com grupo e bloco da hierarquia
    const sqlContas = `SELECT
      LTRIM(RTRIM(COALESCE(pl.nr_planfin, ''))) AS nr_planfin,
      COALESCE(NULLIF(LTRIM(RTRIM(pl.ds_planfin)), ''), 'Sem conta vinculada') AS ds_planfin,
      LEFT(LTRIM(RTRIM(COALESCE(pl.nr_planfin, '000000000'))), 2) AS nr_grupo,
      LEFT(LTRIM(RTRIM(COALESCE(pl.nr_planfin, '000000000'))), 4) AS nr_bloco,
      COUNT(*) AS qtd,
      SUM(CASE WHEN c.fl_status_titulo <> 40 THEN ${val} ELSE 0 END) AS vl_total,
      SUM(CASE WHEN c.fl_status_titulo IN (25, 30) OR c.dt_bai_cap IS NOT NULL THEN ${val} ELSE 0 END) AS vl_pago,
      SUM(CASE WHEN c.fl_status_titulo IN (5, 10) AND c.dt_bai_cap IS NULL THEN ${val} ELSE 0 END) AS vl_aberto,
      SUM(CASE WHEN c.fl_status_titulo IN (5, 10) AND c.dt_bai_cap IS NULL AND c.dt_ven_cap < CAST(GETDATE() AS date) THEN ${val} ELSE 0 END) AS vl_vencido
    FROM cap c WITH (NOLOCK)
    LEFT JOIN plano pl WITH (NOLOCK) ON pl.cd_planfin = c.cd_conta
    WHERE ${periodo}
    GROUP BY pl.nr_planfin, pl.ds_planfin
    ORDER BY SUM(CASE WHEN c.fl_status_titulo <> 40 THEN ${val} ELSE 0 END) DESC`;

    // 2) Rótulos dos nós de grupo e bloco do plano
    const sqlNos = `SELECT
      LTRIM(RTRIM(nr_planfin)) AS nr_planfin,
      LTRIM(RTRIM(ds_planfin)) AS ds_planfin
    FROM plano WITH (NOLOCK)
    WHERE nr_planfin LIKE '2%' AND RIGHT(LTRIM(RTRIM(nr_planfin)), 5) = '00000'`;

    // 3) Série mensal por bloco, pela data de baixa (dinheiro que saiu do caixa)
    const sqlMensal = `SELECT
      YEAR(c.dt_bai_cap) AS ano,
      MONTH(c.dt_bai_cap) AS mes,
      LEFT(LTRIM(RTRIM(COALESCE(pl.nr_planfin, '000000000'))), 4) AS nr_bloco,
      SUM(${val}) AS vl_pago
    FROM cap c WITH (NOLOCK)
    LEFT JOIN plano pl WITH (NOLOCK) ON pl.cd_planfin = c.cd_conta
    WHERE c.dt_bai_cap >= '${startDate}' AND c.dt_bai_cap < '${endDateExclusive}'
      AND c.fl_status_titulo <> 40
    GROUP BY YEAR(c.dt_bai_cap), MONTH(c.dt_bai_cap), LEFT(LTRIM(RTRIM(COALESCE(pl.nr_planfin, '000000000'))), 4)
    ORDER BY 1, 2`;

    let source: Record<string, unknown> = { credential_reference: 'env' };
    if (body?.source_id) {
      source = await base44.asServiceRole.entities.ErpDataSource.get(body.source_id);
      if (!source) return Response.json({ success: false, error: 'Fonte de dados não encontrada.' }, { status: 404 });
    }

    const t0 = Date.now();
    const contas = rows(await execRead(source, sqlContas, 60000));
    const nos = rows(await execRead(source, sqlNos, 30000));
    const mensal = rows(await execRead(source, sqlMensal, 60000));

    return Response.json({
      success: true,
      contas,
      nos,
      mensal,
      period: { start: startDate, end: endDate, end_exclusive: endDateExclusive },
      duration_ms: Date.now() - t0,
      queries: [sqlContas, sqlNos, sqlMensal],
    });
  } catch (error) {
    return Response.json({ success: false, error: (error as Error)?.message || String(error) }, { status: 500 });
  }
}