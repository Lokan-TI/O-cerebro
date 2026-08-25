import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { execRead } from '../../shared/erpConnection.ts';
import { empFilter } from '../../shared/empresaScope.ts';

// Previsibilidade diária de caixa baseada nos fatos financeiros do SISLOC.
// PASSADO = caixa realizado por data de baixa (CAP/CAR).
// PRESENTE = carteira aberta e vencida na data de corte.
// FUTURO COMPROMETIDO = títulos abertos por agendamento/vencimento.
// FUTURO ESPERADO = calendário comprometido ajustado pelo atraso/antecipação mediano histórico.
//
// Importante: previsão esperada é inferência estatística, não fato do ERP.
// CAP não possui dimensão empresa física comprovada; a visão de saídas é consolidada.

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
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function safeDate(value: unknown, fallback: string) {
  const v = String(value || '');
  return DATE_RE.test(v) ? v : fallback;
}

function clampInt(value: unknown, fallback: number, min: number, max: number) {
  const n = Number(value);
  if (!Number.isInteger(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function shiftForecastDate(date: string, lagDays: number, today: string, endExclusive: string) {
  let shifted = addDays(date, lagDays);
  if (shifted < today) shifted = today;
  if (shifted >= endExclusive) return null;
  return shifted;
}

function aggregateDaily(rows: any[], key: 'past' | 'future') {
  const map = new Map<string, any>();
  for (const r of rows) {
    const date = String(r.data || '');
    if (!DATE_RE.test(date)) continue;
    if (!map.has(date)) map.set(date, {
      date,
      entradas: 0,
      saidas: 0,
      qtd_entradas: 0,
      qtd_saidas: 0,
      cap_agendado: 0,
      cap_vencimento: 0,
      cap_provisorio: 0,
      car_vencimento: 0,
      car_provisorio: 0,
    });
    const x = map.get(date);
    const direction = String(r.direcao || '');
    const amount = num(r.valor);
    const count = num(r.qtd);
    if (direction === 'ENTRADA') {
      x.entradas += amount;
      x.qtd_entradas += count;
    } else {
      x.saidas += amount;
      x.qtd_saidas += count;
    }
    if (key === 'future') {
      const bucket = String(r.bucket || '');
      if (bucket === 'CAP_AGENDADO') x.cap_agendado += amount;
      if (bucket === 'CAP_VENCIMENTO') x.cap_vencimento += amount;
      if (bucket === 'CAP_PROVISORIO') x.cap_provisorio += amount;
      if (bucket === 'CAR_VENCIMENTO') x.car_vencimento += amount;
      if (bucket === 'CAR_PROVISORIO') x.car_provisorio += amount;
    }
  }
  return [...map.values()]
    .map(r => ({ ...r, saldo: r.entradas - r.saidas }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function buildExpected(futureRows: any[], capMedianLag: number, carMedianLag: number, today: string, endExclusive: string) {
  const map = new Map<string, any>();
  const add = (date: string, field: 'entradas' | 'saidas', amount: number, source: string) => {
    if (!date) return;
    if (!map.has(date)) map.set(date, { date, entradas: 0, saidas: 0, scheduled_cap: 0, modeled_cap: 0, modeled_car: 0 });
    const r = map.get(date);
    r[field] += amount;
    if (source === 'CAP_AGENDADO') r.scheduled_cap += amount;
    if (source === 'CAP_MODELADO') r.modeled_cap += amount;
    if (source === 'CAR_MODELADO') r.modeled_car += amount;
  };

  for (const r of futureRows) {
    const date = String(r.data || '');
    if (!DATE_RE.test(date)) continue;
    const amount = num(r.valor);
    const bucket = String(r.bucket || '');
    if (bucket === 'CAP_AGENDADO') {
      add(date, 'saidas', amount, 'CAP_AGENDADO');
    } else if (bucket === 'CAP_VENCIMENTO' || bucket === 'CAP_PROVISORIO') {
      const d = shiftForecastDate(date, capMedianLag, today, endExclusive);
      if (d) add(d, 'saidas', amount, 'CAP_MODELADO');
    } else if (bucket === 'CAR_VENCIMENTO' || bucket === 'CAR_PROVISORIO') {
      const d = shiftForecastDate(date, carMedianLag, today, endExclusive);
      if (d) add(d, 'entradas', amount, 'CAR_MODELADO');
    }
  }

  let cumulative = 0;
  return [...map.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(r => {
      const saldo = r.entradas - r.saidas;
      cumulative += saldo;
      return { ...r, saldo, acumulado: cumulative };
    });
}

function summarizeWindow(rows: any[], today: string, days: number) {
  const end = addDays(today, days);
  const scoped = rows.filter(r => r.date >= today && r.date < end);
  const entradas = scoped.reduce((s, r) => s + num(r.entradas), 0);
  const saidas = scoped.reduce((s, r) => s + num(r.saidas), 0);
  return {
    days,
    start: today,
    end_exclusive: end,
    entradas,
    saidas,
    saldo: entradas - saidas,
    cobertura: saidas > 0 ? entradas / saidas : null,
  };
}

export default async function (req: Request): Promise<Response> {
  const started = Date.now();
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const serverToday = new Date().toISOString().slice(0, 10);
    const today = safeDate(body?.as_of_date, serverToday);
    const pastDays = clampInt(body?.past_days, 180, 30, 730);
    const futureDays = clampInt(body?.future_days, 90, 30, 365);
    const pastStart = addDays(today, -pastDays);
    const todayExclusive = addDays(today, 1);
    const futureEnd = addDays(today, futureDays);
    const lagStart = addDays(today, -Math.max(365, pastDays));

    let source: Record<string, unknown> = { credential_reference: 'env' };
    if (body?.source_id) {
      source = await base44.asServiceRole.entities.ErpDataSource.get(body.source_id);
      if (!source) return Response.json({ error: 'Fonte de dados não encontrada.' }, { status: 404 });
    }

    const valCap = 'ROUND(COALESCE(c.vl_pre_cap,0)+COALESCE(c.vl_acr_cap,0)-COALESCE(c.vl_des_cap,0),2)';
    const valCar = 'ROUND(COALESCE(c.vl_pre_car,0)+COALESCE(c.vl_acr_car,0)-COALESCE(c.vl_des_car,0),2)';

    const sqlPastDaily = `
      SELECT CONVERT(char(10), CAST(c.dt_bai_cap AS date), 23) AS data,
        'SAIDA' AS direcao, 'CAP_BAIXA' AS bucket, COUNT(*) AS qtd, SUM(${valCap}) AS valor
      FROM cap c WITH (NOLOCK)
      WHERE c.dt_bai_cap >= '${pastStart}' AND c.dt_bai_cap < '${todayExclusive}'
        AND COALESCE(c.fl_status_titulo,0) <> 40
      GROUP BY CAST(c.dt_bai_cap AS date)
      UNION ALL
      SELECT CONVERT(char(10), CAST(c.dt_bai_car AS date), 23) AS data,
        'ENTRADA' AS direcao, 'CAR_BAIXA' AS bucket, COUNT(*) AS qtd, SUM(${valCar}) AS valor
      FROM car c WITH (NOLOCK)
      WHERE c.dt_bai_car >= '${pastStart}' AND c.dt_bai_car < '${todayExclusive}'
        AND COALESCE(c.fl_status,0) <> 40 AND c.dt_cancelamento IS NULL ${empFilter('c', 'cd_empresa_gestora')}
      GROUP BY CAST(c.dt_bai_car AS date)
      ORDER BY data`;

    const sqlFutureDaily = `
      SELECT CONVERT(char(10), CAST(c.dt_agendpagto AS date), 23) AS data,
        'SAIDA' AS direcao, 'CAP_AGENDADO' AS bucket, COUNT(*) AS qtd, SUM(${valCap}) AS valor
      FROM cap c WITH (NOLOCK)
      WHERE c.dt_bai_cap IS NULL AND COALESCE(c.fl_status_titulo,0) IN (5,10)
        AND c.dt_agendpagto >= '${today}' AND c.dt_agendpagto < '${futureEnd}'
      GROUP BY CAST(c.dt_agendpagto AS date)
      UNION ALL
      SELECT CONVERT(char(10), CAST(c.dt_ven_cap AS date), 23) AS data,
        'SAIDA' AS direcao,
        CASE WHEN c.fl_status_titulo = 5 THEN 'CAP_PROVISORIO' ELSE 'CAP_VENCIMENTO' END AS bucket,
        COUNT(*) AS qtd, SUM(${valCap}) AS valor
      FROM cap c WITH (NOLOCK)
      WHERE c.dt_bai_cap IS NULL AND COALESCE(c.fl_status_titulo,0) IN (5,10)
        AND (c.dt_agendpagto IS NULL OR c.dt_agendpagto < '${today}')
        AND c.dt_ven_cap >= '${today}' AND c.dt_ven_cap < '${futureEnd}'
      GROUP BY CAST(c.dt_ven_cap AS date), CASE WHEN c.fl_status_titulo = 5 THEN 'CAP_PROVISORIO' ELSE 'CAP_VENCIMENTO' END
      UNION ALL
      SELECT CONVERT(char(10), CAST(c.dt_ven_car AS date), 23) AS data,
        'ENTRADA' AS direcao,
        CASE WHEN c.fl_status = 5 THEN 'CAR_PROVISORIO' ELSE 'CAR_VENCIMENTO' END AS bucket,
        COUNT(*) AS qtd, SUM(${valCar}) AS valor
      FROM car c WITH (NOLOCK)
      WHERE c.dt_bai_car IS NULL AND COALESCE(c.fl_status,0) IN (5,10) AND c.dt_cancelamento IS NULL
        AND c.dt_ven_car >= '${today}' AND c.dt_ven_car < '${futureEnd}' ${empFilter('c', 'cd_empresa_gestora')}
      GROUP BY CAST(c.dt_ven_car AS date), CASE WHEN c.fl_status = 5 THEN 'CAR_PROVISORIO' ELSE 'CAR_VENCIMENTO' END
      ORDER BY data`;

    const sqlPresent = `SELECT
      (SELECT ISNULL(SUM(${valCap}),0) FROM cap c WITH (NOLOCK)
        WHERE c.dt_bai_cap IS NULL AND COALESCE(c.fl_status_titulo,0) IN (5,10) AND c.dt_ven_cap < '${today}') AS cap_vencido,
      (SELECT COUNT(*) FROM cap c WITH (NOLOCK)
        WHERE c.dt_bai_cap IS NULL AND COALESCE(c.fl_status_titulo,0) IN (5,10) AND c.dt_ven_cap < '${today}') AS cap_vencido_qtd,
      (SELECT ISNULL(SUM(${valCap}),0) FROM cap c WITH (NOLOCK)
        WHERE c.dt_bai_cap IS NULL AND c.fl_status_titulo = 5 AND c.dt_ven_cap >= '${today}') AS cap_provisorio,
      (SELECT ISNULL(SUM(${valCap}),0) FROM cap c WITH (NOLOCK)
        WHERE c.dt_bai_cap IS NULL AND COALESCE(c.fl_status_titulo,0) IN (5,10)
          AND c.dt_agendpagto >= '${today}' AND c.dt_agendpagto < DATEADD(day,8,CAST('${today}' AS date))) AS cap_agendado_7d,
      (SELECT ISNULL(SUM(${valCar}),0) FROM car c WITH (NOLOCK)
        WHERE c.dt_bai_car IS NULL AND COALESCE(c.fl_status,0) IN (5,10) AND c.dt_cancelamento IS NULL
          AND c.dt_ven_car < '${today}' ${empFilter('c', 'cd_empresa_gestora')}) AS car_vencido,
      (SELECT COUNT(*) FROM car c WITH (NOLOCK)
        WHERE c.dt_bai_car IS NULL AND COALESCE(c.fl_status,0) IN (5,10) AND c.dt_cancelamento IS NULL
          AND c.dt_ven_car < '${today}' ${empFilter('c', 'cd_empresa_gestora')}) AS car_vencido_qtd,
      (SELECT ISNULL(SUM(${valCar}),0) FROM car c WITH (NOLOCK)
        WHERE c.dt_bai_car IS NULL AND c.fl_status = 5 AND c.dt_cancelamento IS NULL
          AND c.dt_ven_car >= '${today}' ${empFilter('c', 'cd_empresa_gestora')}) AS car_provisorio`;

    const sqlCapLag = `SELECT TOP 1
        AVG(CAST(x.lag_days AS float)) OVER () AS avg_lag,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY x.lag_days) OVER () AS median_lag,
        AVG(CASE WHEN x.lag_days < 0 THEN 1.0 ELSE 0.0 END) OVER () * 100.0 AS pct_antes,
        AVG(CASE WHEN x.lag_days = 0 THEN 1.0 ELSE 0.0 END) OVER () * 100.0 AS pct_no_dia,
        AVG(CASE WHEN x.lag_days > 0 THEN 1.0 ELSE 0.0 END) OVER () * 100.0 AS pct_depois,
        COUNT(*) OVER () AS qtd
      FROM (
        SELECT DATEDIFF(day, CAST(c.dt_ven_cap AS date), CAST(c.dt_bai_cap AS date)) AS lag_days
        FROM cap c WITH (NOLOCK)
        WHERE c.dt_bai_cap >= '${lagStart}' AND c.dt_bai_cap < '${todayExclusive}'
          AND c.dt_ven_cap IS NOT NULL AND COALESCE(c.fl_status_titulo,0) <> 40
      ) x`;

    const sqlCarLag = `SELECT TOP 1
        AVG(CAST(x.lag_days AS float)) OVER () AS avg_lag,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY x.lag_days) OVER () AS median_lag,
        AVG(CASE WHEN x.lag_days < 0 THEN 1.0 ELSE 0.0 END) OVER () * 100.0 AS pct_antes,
        AVG(CASE WHEN x.lag_days = 0 THEN 1.0 ELSE 0.0 END) OVER () * 100.0 AS pct_no_dia,
        AVG(CASE WHEN x.lag_days > 0 THEN 1.0 ELSE 0.0 END) OVER () * 100.0 AS pct_depois,
        COUNT(*) OVER () AS qtd
      FROM (
        SELECT DATEDIFF(day, CAST(c.dt_ven_car AS date), CAST(c.dt_bai_car AS date)) AS lag_days
        FROM car c WITH (NOLOCK)
        WHERE c.dt_bai_car >= '${lagStart}' AND c.dt_bai_car < '${todayExclusive}'
          AND c.dt_ven_car IS NOT NULL AND COALESCE(c.fl_status,0) <> 40 AND c.dt_cancelamento IS NULL
          ${empFilter('c', 'cd_empresa_gestora')}
      ) x`;

    const sqlTopOpen = `
      SELECT TOP 30 'SAIDA' AS direcao,
        CONVERT(char(10), CAST(CASE WHEN c.dt_agendpagto >= '${today}' THEN c.dt_agendpagto ELSE c.dt_ven_cap END AS date),23) AS data,
        COALESCE(NULLIF(LTRIM(RTRIM(p.nm_pessoa)),''),'(sem fornecedor)') AS pessoa,
        COALESCE(NULLIF(LTRIM(RTRIM(pl.ds_planfin)),''),'Sem conta') AS conta,
        ${valCap} AS valor,
        CASE WHEN c.dt_agendpagto >= '${today}' THEN 'AGENDADO' WHEN c.fl_status_titulo = 5 THEN 'PROVISORIO' ELSE 'A_VENCER' END AS situacao
      FROM cap c WITH (NOLOCK)
      LEFT JOIN pessoa p WITH (NOLOCK) ON p.cd_pessoa = c.cd_pessoa_cre
      LEFT JOIN plano pl WITH (NOLOCK) ON pl.cd_planfin = c.cd_conta
      WHERE c.dt_bai_cap IS NULL AND COALESCE(c.fl_status_titulo,0) IN (5,10)
        AND (c.dt_ven_cap < '${futureEnd}' OR c.dt_agendpagto < '${futureEnd}')
      ORDER BY ${valCap} DESC;
      SELECT TOP 30 'ENTRADA' AS direcao,
        CONVERT(char(10), CAST(c.dt_ven_car AS date),23) AS data,
        COALESCE(NULLIF(LTRIM(RTRIM(p.nm_pessoa)),''),'(sem cliente)') AS pessoa,
        COALESCE(NULLIF(LTRIM(RTRIM(pl.ds_planfin)),''),'Sem conta') AS conta,
        ${valCar} AS valor,
        CASE WHEN c.dt_ven_car < '${today}' THEN 'VENCIDO' WHEN c.fl_status = 5 THEN 'PROVISORIO' ELSE 'A_VENCER' END AS situacao
      FROM car c WITH (NOLOCK)
      LEFT JOIN pessoa p WITH (NOLOCK) ON p.cd_pessoa = c.cd_pessoa_cli
      LEFT JOIN plano pl WITH (NOLOCK) ON pl.cd_planfin = c.cd_conta
      WHERE c.dt_bai_car IS NULL AND COALESCE(c.fl_status,0) IN (5,10) AND c.dt_cancelamento IS NULL
        AND c.dt_ven_car < '${futureEnd}' ${empFilter('c', 'cd_empresa_gestora')}
      ORDER BY ${valCar} DESC`;

    const warnings: string[] = [];
    const run = async (label: string, sql: string, timeout = 45000) => {
      try {
        return await execRead(source, sql, timeout);
      } catch (e) {
        warnings.push(`${label}: ${(e as Error)?.message || String(e)}`);
        return null;
      }
    };

    const pastRes = await run('Histórico diário realizado', sqlPastDaily);
    const futureRes = await run('Calendário futuro comprometido', sqlFutureDaily);
    const presentRes = await run('Posição atual', sqlPresent);
    const capLagRes = await run('Comportamento histórico CAP', sqlCapLag);
    const carLagRes = await run('Comportamento histórico CAR', sqlCarLag);
    const topRes = await run('Maiores títulos abertos', sqlTopOpen, 60000);

    const pastRows = rowsOf(pastRes);
    const futureRows = rowsOf(futureRes);
    const presentRow = rowsOf(presentRes)[0] || {};
    const capLagRow = rowsOf(capLagRes)[0] || {};
    const carLagRow = rowsOf(carLagRes)[0] || {};

    const capLag = {
      avg_days: num(capLagRow.avg_lag),
      median_days: Math.round(num(capLagRow.median_lag)),
      pct_before_due: num(capLagRow.pct_antes),
      pct_on_due: num(capLagRow.pct_no_dia),
      pct_after_due: num(capLagRow.pct_depois),
      sample_size: num(capLagRow.qtd),
    };
    const carLag = {
      avg_days: num(carLagRow.avg_lag),
      median_days: Math.round(num(carLagRow.median_lag)),
      pct_before_due: num(carLagRow.pct_antes),
      pct_on_due: num(carLagRow.pct_no_dia),
      pct_after_due: num(carLagRow.pct_depois),
      sample_size: num(carLagRow.qtd),
    };

    const history = aggregateDaily(pastRows, 'past');
    const committed = aggregateDaily(futureRows, 'future');
    const expected = buildExpected(futureRows, capLag.median_days, carLag.median_days, today, futureEnd);

    const totalPastIn = history.reduce((s, r) => s + num(r.entradas), 0);
    const totalPastOut = history.reduce((s, r) => s + num(r.saidas), 0);
    const totalFutureIn = expected.reduce((s, r) => s + num(r.entradas), 0);
    const totalFutureOut = expected.reduce((s, r) => s + num(r.saidas), 0);
    const minCumulative = expected.reduce((m, r) => Math.min(m, num(r.acumulado)), 0);
    const peakOut = [...expected].sort((a, b) => b.saidas - a.saidas).slice(0, 10);
    const peakIn = [...expected].sort((a, b) => b.entradas - a.entradas).slice(0, 10);

    const resultSets = Array.isArray((topRes as any)?.recordsets) ? (topRes as any).recordsets : [];
    const topCap = Array.isArray(resultSets[0]) ? resultSets[0] : [];
    const topCar = Array.isArray(resultSets[1]) ? resultSets[1] : [];

    return Response.json({
      generated_at: new Date().toISOString(),
      as_of_date: today,
      horizons: { past_days: pastDays, future_days: futureDays, past_start: pastStart, future_end_exclusive: futureEnd },
      methodology: {
        past: 'Realizado por dt_bai_cap / dt_bai_car.',
        present: 'Títulos em aberto/vencidos na data de corte.',
        future_committed: 'CAP: dt_agendpagto quando existente, senão dt_ven_cap; CAR: dt_ven_car.',
        future_expected: 'Títulos comprometidos deslocados pela mediana histórica de dias entre vencimento e baixa; CAP agendado não é deslocado.',
        value_formula: 'vl_pre + vl_acr - vl_des',
        cap_scope: 'Consolidado: CAP não possui dimensão empresa física comprovada.',
      },
      history,
      present: {
        cap_overdue: num(presentRow.cap_vencido),
        cap_overdue_count: num(presentRow.cap_vencido_qtd),
        cap_provisional: num(presentRow.cap_provisorio),
        cap_scheduled_7d: num(presentRow.cap_agendado_7d),
        car_overdue: num(presentRow.car_vencido),
        car_overdue_count: num(presentRow.car_vencido_qtd),
        car_provisional: num(presentRow.car_provisorio),
      },
      behavior: { cap: capLag, car: carLag },
      future: {
        committed,
        expected,
        windows: [7, 14, 30, 60, 90].filter(d => d <= futureDays).map(d => summarizeWindow(expected, today, d)),
        total_expected_in: totalFutureIn,
        total_expected_out: totalFutureOut,
        net_expected: totalFutureIn - totalFutureOut,
        liquidity_need_from_zero: Math.max(0, -minCumulative),
        coverage: totalFutureOut > 0 ? totalFutureIn / totalFutureOut : null,
        peak_out_days: peakOut,
        peak_in_days: peakIn,
      },
      past_summary: {
        total_in: totalPastIn,
        total_out: totalPastOut,
        net: totalPastIn - totalPastOut,
        avg_daily_in: pastDays > 0 ? totalPastIn / pastDays : 0,
        avg_daily_out: pastDays > 0 ? totalPastOut / pastDays : 0,
        peak_out_days: [...history].sort((a, b) => b.saidas - a.saidas).slice(0, 10),
        peak_in_days: [...history].sort((a, b) => b.entradas - a.entradas).slice(0, 10),
      },
      top_open: {
        cap: topCap.map((r: any) => ({ data: String(r.data || ''), pessoa: String(r.pessoa || ''), conta: String(r.conta || ''), valor: num(r.valor), situacao: String(r.situacao || '') })),
        car: topCar.map((r: any) => ({ data: String(r.data || ''), pessoa: String(r.pessoa || ''), conta: String(r.conta || ''), valor: num(r.valor), situacao: String(r.situacao || '') })),
      },
      warnings,
      duration_ms: Date.now() - started,
      lineage: [
        { label: 'Passado realizado', sql: sqlPastDaily },
        { label: 'Futuro comprometido', sql: sqlFutureDaily },
        { label: 'Posição atual', sql: sqlPresent },
        { label: 'Comportamento CAP', sql: sqlCapLag },
        { label: 'Comportamento CAR', sql: sqlCarLag },
        { label: 'Maiores títulos abertos', sql: sqlTopOpen },
      ],
    });
  } catch (error) {
    return Response.json({ error: (error as Error)?.message || String(error) }, { status: 500 });
  }
}
