import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { execRead } from '../../shared/erpConnection.ts';
import { resolvePeriod } from '../../shared/periodContract.ts';

// CAR agrupado por empresa gestora + ano/mês de emissão, direto do banco.
// Mesma regra canônica do bloco analítico (car_by_empresa):
// Liquidado (25/30 ou com baixa) · A vencer (10 sem baixa, venc. futuro) ·
// Vencido (5/10 sem baixa, venc. passado) · Provisório (5 sem baixa, venc. futuro — à parte).
// Total = Liquidado + A vencer + Vencido · cancelado (40) fora de tudo.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const period = resolvePeriod({
      start: body?.start_date,
      endInclusive: body?.end_date,
      endExclusive: body?.end_date_exclusive,
      defaultStart: '2013-01-01',
      defaultEndInclusive: new Date().toISOString().slice(0, 10),
    });

    const sql = `SELECT c.cd_empresa_gestora AS cd_empresa, YEAR(c.dt_emi_car) AS ano, MONTH(c.dt_emi_car) AS mes,
      COUNT(*) AS qtd,
      SUM(CASE WHEN c.fl_status IN (25,30) OR (c.fl_status <> 40 AND c.dt_bai_car IS NOT NULL) THEN v.val ELSE 0 END) AS vl_liquidado,
      SUM(CASE WHEN c.fl_status = 10 AND c.dt_bai_car IS NULL AND c.dt_ven_car >= CAST(GETDATE() AS date) THEN v.val ELSE 0 END) AS vl_a_vencer,
      SUM(CASE WHEN c.fl_status IN (5,10) AND c.dt_bai_car IS NULL AND c.dt_ven_car < CAST(GETDATE() AS date) THEN v.val ELSE 0 END) AS vl_vencido,
      SUM(CASE WHEN c.fl_status = 5 AND c.dt_bai_car IS NULL AND c.dt_ven_car >= CAST(GETDATE() AS date) THEN v.val ELSE 0 END) AS vl_provisorio,
      SUM(ISNULL(c.vl_juros,0)+ISNULL(c.vl_multa,0)) AS vl_juros_multa
    FROM car c WITH (NOLOCK)
    CROSS APPLY (SELECT ROUND(COALESCE(c.vl_pre_car,0)+COALESCE(c.vl_acr_car,0)-COALESCE(c.vl_des_car,0),2) AS val) v
    WHERE c.dt_emi_car >= '${period.start}' AND c.dt_emi_car < '${period.endExclusive}'
    GROUP BY c.cd_empresa_gestora, YEAR(c.dt_emi_car), MONTH(c.dt_emi_car)`;

    let source: Record<string, unknown> = { credential_reference: 'env' };
    if (body?.source_id) {
      source = await base44.asServiceRole.entities.ErpDataSource.get(body.source_id).catch((e) => (e.status === 404 ? null : Promise.reject(e)));
      if (!source) return Response.json({ success: false, error: 'Fonte de dados não encontrada.' }, { status: 404 });
    }

    const t0 = Date.now();
    const result = await execRead(source, sql, 90000);
    const raw = Array.isArray(result?.recordset) ? result.recordset : [];
    const rows = raw.map((r: Record<string, unknown>) => {
      const liq = Number(r.vl_liquidado) || 0;
      const av = Number(r.vl_a_vencer) || 0;
      const ven = Number(r.vl_vencido) || 0;
      return {
        cd_empresa: r.cd_empresa == null ? null : Number(r.cd_empresa),
        ano: Number(r.ano), mes: Number(r.mes), qtd: Number(r.qtd) || 0,
        vl_liquidado: liq, vl_a_vencer: av, vl_vencido: ven,
        vl_provisorio: Number(r.vl_provisorio) || 0,
        vl_juros_multa: Number(r.vl_juros_multa) || 0,
        vl_total: liq + av + ven,
      };
    });

    return Response.json({ success: true, rows, period: { start: period.start, end: period.endInclusive }, duration_ms: Date.now() - t0 });
  } catch (error) {
    return Response.json({ success: false, error: (error as Error)?.message || String(error) }, { status: 500 });
  }
}