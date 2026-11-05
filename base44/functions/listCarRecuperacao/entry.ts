import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { execRead } from '../../shared/erpConnection.ts';
import { resolvePeriod } from '../../shared/periodContract.ts';
import { empFilter } from '../../shared/empresaScope.ts';

// Recuperação e inadimplência do CAR (por data de emissão, mesma regra canônica do listCarAnalise):
// universo = liquidado (25/30 ou com baixa, exceto 40) + em aberto (5/10 sem baixa), só títulos já vencidos.
// 1) curvas: por empresa × mês de vencimento — valor devido, recuperado por faixa de dias após o vencimento
//    e aging do que segue em aberto. 2) titulos: lista dos títulos vencidos em aberto.
const TOP = 5000;

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

    let source: Record<string, unknown> = { credential_reference: 'env' };
    if (body?.source_id) {
      source = await base44.asServiceRole.entities.ErpDataSource.get(body.source_id).catch((e) => (e.status === 404 ? null : Promise.reject(e)));
      if (!source) return Response.json({ success: false, error: 'Fonte de dados não encontrada.' }, { status: 404 });
    }

    const where = `c.dt_emi_car >= '${period.start}' AND c.dt_emi_car < '${period.endExclusive}' AND c.dt_ven_car < CAST(GETDATE() AS date) ${empFilter('c', 'cd_empresa_gestora')}`;
    const base = `FROM car c WITH (NOLOCK)
      CROSS APPLY (SELECT ROUND(COALESCE(c.vl_pre_car,0)+COALESCE(c.vl_acr_car,0)-COALESCE(c.vl_des_car,0),2) AS val,
        CASE WHEN c.fl_status IN (25,30) OR (c.fl_status <> 40 AND c.dt_bai_car IS NOT NULL) THEN 1 ELSE 0 END AS liq,
        CASE WHEN c.fl_status IN (5,10) AND c.dt_bai_car IS NULL THEN 1 ELSE 0 END AS ab,
        ISNULL(DATEDIFF(day, c.dt_ven_car, c.dt_bai_car), 99999) AS dr,
        DATEDIFF(day, c.dt_ven_car, CAST(GETDATE() AS date)) AS da) q`;

    const r = (cond: string) => `SUM(CASE WHEN q.liq = 1 AND ${cond} THEN q.val ELSE 0 END)`;
    const a = (cond: string) => `SUM(CASE WHEN q.ab = 1 AND ${cond} THEN q.val ELSE 0 END)`;
    const curvasSql = `SELECT c.cd_empresa_gestora AS cd_empresa, YEAR(c.dt_ven_car) AS ano, MONTH(c.dt_ven_car) AS mes,
      SUM(q.val) AS devido, SUM(q.ab) AS qtd_aberto,
      ${r('q.dr <= 0')} AS r0, ${r('q.dr BETWEEN 1 AND 30')} AS r30, ${r('q.dr BETWEEN 31 AND 60')} AS r60,
      ${r('q.dr BETWEEN 61 AND 90')} AS r90, ${r('q.dr BETWEEN 91 AND 180')} AS r180, ${r('q.dr BETWEEN 181 AND 365')} AS r365,
      ${r('q.dr > 365')} AS rmais,
      ${a('q.da <= 30')} AS a30, ${a('q.da BETWEEN 31 AND 60')} AS a60, ${a('q.da BETWEEN 61 AND 90')} AS a90,
      ${a('q.da BETWEEN 91 AND 180')} AS a180, ${a('q.da BETWEEN 181 AND 365')} AS a365, ${a('q.da > 365')} AS amais
      ${base}
      WHERE ${where} AND (q.liq = 1 OR q.ab = 1)
      GROUP BY c.cd_empresa_gestora, YEAR(c.dt_ven_car), MONTH(c.dt_ven_car)`.replace(/\s+/g, ' ');

    const titulosSql = `SELECT TOP ${TOP} c.cd_lan, c.cd_empresa_gestora AS cd_empresa, c.nf_numero,
      LTRIM(RTRIM(COALESCE(NULLIF(p.nm_fan_pessoa, ''), p.nm_pessoa, ''))) AS cliente, p.cd_pessoa,
      CONVERT(char(10), c.dt_emi_car, 23) AS emissao, CONVERT(char(10), c.dt_ven_car, 23) AS vencimento,
      q.da AS dias, q.val AS valor
      ${base}
      LEFT JOIN pessoa p WITH (NOLOCK) ON p.cd_pessoa = c.cd_pessoa_cli
      WHERE ${where} AND q.ab = 1
      ORDER BY q.val DESC`.replace(/\s+/g, ' ');

    const t0 = Date.now();
    // Sequencial: evita carga concorrente no ERP.
    const cur = await execRead(source, curvasSql, 90000);
    const tit = await execRead(source, titulosSql, 90000);
    const num = (v: unknown) => Number(v) || 0;
    const curvas = (cur?.recordset || []).map((x: Record<string, unknown>) => {
      const o: Record<string, unknown> = { cd_empresa: x.cd_empresa == null ? null : Number(x.cd_empresa), ano: Number(x.ano), mes: Number(x.mes) };
      for (const k of ['devido', 'qtd_aberto', 'r0', 'r30', 'r60', 'r90', 'r180', 'r365', 'rmais', 'a30', 'a60', 'a90', 'a180', 'a365', 'amais']) o[k] = num(x[k]);
      return o;
    });
    const titulos = (tit?.recordset || []).map((x: Record<string, unknown>) => ({
      cd_lan: x.cd_lan, cd_empresa: x.cd_empresa == null ? null : Number(x.cd_empresa),
      nf_numero: x.nf_numero ?? '', cliente: x.cliente || '', cd_pessoa: x.cd_pessoa ?? '',
      emissao: x.emissao, vencimento: x.vencimento, dias: num(x.dias), valor: num(x.valor),
    }));

    return Response.json({ success: true, curvas, titulos, limite: TOP, duration_ms: Date.now() - t0 });
  } catch (error) {
    return Response.json({ success: false, error: (error as Error)?.message || String(error) }, { status: 500 });
  }
}