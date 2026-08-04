import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { buildConfig, runQuery } from '../../shared/erpConnection.ts';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

function getRows(result) {
  if (!result) return [];
  if (Array.isArray(result.recordset) && result.recordset.length > 0) return result.recordset;
  if (Array.isArray(result.recordsets)) {
    for (let i = result.recordsets.length - 1; i >= 0; i--) {
      if (Array.isArray(result.recordsets[i]) && result.recordsets[i].length > 0) return result.recordsets[i];
    }
  }
  if (Array.isArray(result)) return result;
  return [];
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const sourceId = body?.source_id;
    if (!sourceId) return Response.json({ success: false, error: 'source_id é obrigatório.' });

    const source = await base44.asServiceRole.entities.ErpDataSource.get(sourceId);
    if (!source) return Response.json({ success: false, error: 'Fonte de dados não encontrada.' });

    const refStart = body?.ref_start;
    const refEnd = body?.ref_end;
    const analysisStart = body?.analysis_start;
    const analysisEnd = body?.analysis_end;

    if (!dateRegex.test(refStart || '') || !dateRegex.test(refEnd || '') ||
        !dateRegex.test(analysisStart || '') || !dateRegex.test(analysisEnd || '')) {
      return Response.json({ success: false, error: 'Datas devem estar no formato YYYY-MM-DD.' });
    }

    const config = buildConfig(source);
    if (!config) throw new Error('Configuração de conexão incompleta.');

    const wrap = (inner) => config.clientId
      ? `EXEC DW_API '${config.clientId}', '${inner.replace(/'/g, "''")}'`
      : inner;

    // Detect cancel filter
    let cancelFilter = '';
    try {
      const checkRes = await runQuery(source, wrap("SELECT TOP 1 fl_can_nf AS v FROM nf WHERE fl_can_nf IS NOT NULL"));
      const checkRow = getRows(checkRes)[0];
      if (checkRow && checkRow.v != null) {
        if (typeof checkRow.v === 'string') cancelFilter = "AND fl_can_nf <> 'S'";
        else cancelFilter = 'AND fl_can_nf = 0';
      }
    } catch {}

    // Churn: clients who purchased in ref period but NOT in analysis period
    const churnSql = `WITH ref_clients AS (
      SELECT cd_pessoa,
             ISNULL(SUM(vl_faturamento),0) AS ref_revenue,
             COUNT(*) AS ref_nfs,
             MIN(dt_emi_nf) AS ref_first_nf,
             MAX(dt_emi_nf) AS ref_last_nf
      FROM nf WITH (NOLOCK)
      WHERE dt_emi_nf >= '${refStart}' AND dt_emi_nf < '${refEnd}' ${cancelFilter}
        AND cd_pessoa IS NOT NULL AND cd_pessoa <> ''
      GROUP BY cd_pessoa
    ),
    analysis_clients AS (
      SELECT cd_pessoa,
             ISNULL(SUM(vl_faturamento),0) AS analysis_revenue,
             COUNT(*) AS analysis_nfs,
             MAX(dt_emi_nf) AS analysis_last_nf
      FROM nf WITH (NOLOCK)
      WHERE dt_emi_nf >= '${analysisStart}' AND dt_emi_nf < '${analysisEnd}' ${cancelFilter}
        AND cd_pessoa IS NOT NULL AND cd_pessoa <> ''
      GROUP BY cd_pessoa
    )
    SELECT
      r.cd_pessoa,
      r.ref_revenue,
      r.ref_nfs,
      r.ref_first_nf,
      r.ref_last_nf,
      COALESCE(a.analysis_revenue, 0) AS analysis_revenue,
      COALESCE(a.analysis_nfs, 0) AS analysis_nfs,
      a.analysis_last_nf,
      CASE WHEN a.cd_pessoa IS NULL THEN 1 ELSE 0 END AS is_churned
    FROM ref_clients r
    LEFT JOIN analysis_clients a ON r.cd_pessoa = a.cd_pessoa
    ORDER BY r.ref_revenue DESC`;

    const result = await runQuery(source, wrap(churnSql));
    const rows = getRows(result);

    const totalRef = rows.length;
    const churnedRows = rows.filter(r => Number(r.is_churned) === 1);
    const activeRows = rows.filter(r => Number(r.is_churned) === 0);
    const revenueAtRisk = churnedRows.reduce((s, r) => s + (Number(r.ref_revenue) || 0), 0);
    const activeRevenue = activeRows.reduce((s, r) => s + (Number(r.ref_revenue) || 0), 0);
    const churnRate = totalRef > 0 ? (churnedRows.length / totalRef * 100) : 0;

    // Monthly churn: when did churned clients last purchase?
    const monthlyChurn = {};
    for (const r of churnedRows) {
      if (r.ref_last_nf) {
        const d = new Date(r.ref_last_nf);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthlyChurn[key] = (monthlyChurn[key] || 0) + 1;
      }
    }
    const monthlyChurnArray = Object.entries(monthlyChurn)
      .map(([k, v]) => {
        const [y, m] = k.split('-');
        return { ano: Number(y), mes: Number(m), churned: v };
      })
      .sort((a, b) => a.ano === b.ano ? a.mes - b.mes : a.ano - b.ano);

    return Response.json({
      success: true,
      summary: {
        total_ref_clients: totalRef,
        active_clients: activeRows.length,
        churned_clients: churnedRows.length,
        churn_rate: churnRate,
        revenue_at_risk: revenueAtRisk,
        active_revenue: activeRevenue,
        avg_churned_revenue: churnedRows.length > 0 ? revenueAtRisk / churnedRows.length : 0,
      },
      churned_clients: churnedRows.slice(0, 500).map(r => ({
        cd_pessoa: String(r.cd_pessoa || ''),
        ref_revenue: Number(r.ref_revenue) || 0,
        ref_nfs: Number(r.ref_nfs) || 0,
        ref_first_nf: r.ref_first_nf ? new Date(r.ref_first_nf).toISOString().slice(0, 10) : null,
        ref_last_nf: r.ref_last_nf ? new Date(r.ref_last_nf).toISOString().slice(0, 10) : null,
        analysis_revenue: Number(r.analysis_revenue) || 0,
        analysis_nfs: Number(r.analysis_nfs) || 0,
      })),
      monthly_churn: monthlyChurnArray,
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message || String(error) }, { status: 500 });
  }
});