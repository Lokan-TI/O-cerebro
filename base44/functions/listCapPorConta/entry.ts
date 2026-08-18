import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { execRead } from '../../shared/erpConnection.ts';

// CAP agrupado por conta do plano financeiro, direto do banco.
// Quatro categorias relevantes: Liquidado (25/30 ou com data de baixa) ·
// A vencer (10 sem baixa, vencimento futuro) · Vencido (5/10 sem baixa, vencimento passado) ·
// Provisório (5 sem baixa, vencimento futuro — previsibilidade, fora do total a pagar).
// Cancelado (40) fica fora de tudo.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const startDate = String(body?.start_date || '2013-01-01');
    const endDate = String(body?.end_date || new Date().toISOString().slice(0, 10));

    const sql = `SELECT
      c.cd_conta,
      LTRIM(RTRIM(COALESCE(pl.nr_planfin, ''))) AS nr_planfin,
      COALESCE(NULLIF(LTRIM(RTRIM(pl.ds_planfin)), ''), 'Sem conta vinculada') AS ds_planfin,
      LTRIM(RTRIM(COALESCE(pl.tp_mov, ''))) AS tp_mov,
      LTRIM(RTRIM(COALESCE(pl.fl_planfin, ''))) AS fl_planfin,
      COUNT(*) AS qtd,
      SUM(CASE WHEN c.fl_status_titulo = 40 THEN 1 ELSE 0 END) AS qtd_cancelado,
      SUM(CASE WHEN c.fl_status_titulo <> 40 AND NOT (c.fl_status_titulo = 5 AND c.dt_bai_cap IS NULL AND c.dt_ven_cap >= CAST(GETDATE() AS date)) THEN v.val ELSE 0 END) AS vl_total,
      SUM(CASE WHEN c.fl_status_titulo IN (25, 30) OR (c.fl_status_titulo <> 40 AND c.dt_bai_cap IS NOT NULL) THEN v.val ELSE 0 END) AS vl_liquidado,
      SUM(CASE WHEN c.fl_status_titulo = 10 AND c.dt_bai_cap IS NULL AND c.dt_ven_cap >= CAST(GETDATE() AS date) THEN v.val ELSE 0 END) AS vl_a_vencer,
      SUM(CASE WHEN c.fl_status_titulo IN (5, 10) AND c.dt_bai_cap IS NULL AND c.dt_ven_cap < CAST(GETDATE() AS date) THEN v.val ELSE 0 END) AS vl_vencido,
      SUM(CASE WHEN c.fl_status_titulo = 5 AND c.dt_bai_cap IS NULL AND c.dt_ven_cap >= CAST(GETDATE() AS date) THEN v.val ELSE 0 END) AS vl_provisorio,
      SUM(CASE WHEN c.fl_status_titulo = 40 THEN v.val ELSE 0 END) AS vl_cancelado
    FROM cap c WITH (NOLOCK)
    LEFT JOIN plano pl WITH (NOLOCK) ON pl.cd_planfin = c.cd_conta
    CROSS APPLY (SELECT ROUND(COALESCE(c.vl_pre_cap, 0) + COALESCE(c.vl_acr_cap, 0) - COALESCE(c.vl_des_cap, 0), 2) AS val) v
    WHERE c.dt_emi_cap >= '${startDate}' AND c.dt_emi_cap < DATEADD(day, 1, CAST('${endDate}' AS date))
    GROUP BY c.cd_conta, pl.nr_planfin, pl.ds_planfin, pl.tp_mov, pl.fl_planfin
    ORDER BY SUM(CASE WHEN c.fl_status_titulo <> 40 AND NOT (c.fl_status_titulo = 5 AND c.dt_bai_cap IS NULL AND c.dt_ven_cap >= CAST(GETDATE() AS date)) THEN v.val ELSE 0 END) DESC`;

    let source: Record<string, unknown> = { credential_reference: 'env' };
    if (body?.source_id) {
      source = await base44.asServiceRole.entities.ErpDataSource.get(body.source_id);
      if (!source) return Response.json({ success: false, error: 'Fonte de dados não encontrada.' }, { status: 404 });
    }

    const t0 = Date.now();
    const result = await execRead(source, sql, 60000);
    let rows: unknown[] = [];
    if (Array.isArray(result?.recordset) && result.recordset.length > 0) {
      rows = result.recordset;
    } else if (Array.isArray(result?.recordsets)) {
      for (let i = result.recordsets.length - 1; i >= 0; i--) {
        const rs = result.recordsets[i];
        if (Array.isArray(rs) && rs.length > 0) { rows = rs; break; }
      }
    }

    return Response.json({ success: true, rows, total: rows.length, duration_ms: Date.now() - t0, sql });
  } catch (error) {
    return Response.json({ success: false, error: (error as Error)?.message || String(error) }, { status: 500 });
  }
}