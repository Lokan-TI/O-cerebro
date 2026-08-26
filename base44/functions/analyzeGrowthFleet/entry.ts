import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { execRead } from '../../shared/erpConnection.ts';
import { resolvePeriod } from '../../shared/periodContract.ts';
import { empFilter } from '../../shared/empresaScope.ts';

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

const num = (value: unknown) => value === null || value === undefined || value === '' ? 0 : Number(value) || 0;

async function resolveSource(base44: any, sourceId?: string) {
  if (sourceId && sourceId !== '__all__') {
    return await base44.asServiceRole.entities.ErpDataSource.get(sourceId);
  }
  const sources = await base44.asServiceRole.entities.ErpDataSource.list();
  const active = (sources || []).filter((source: any) => source?.is_active !== false);
  return active.find((source: any) => String(source?.status || '').toLowerCase() === 'connected')
    || active.find((source: any) => String(source?.name || '').toLowerCase() === 'matriz')
    || active.find((source: any) => source?.credential_reference === 'env')
    || active[0]
    || null;
}

// Complemento assíncrono da Visão Geral de Growth.
// Isola as consultas mais pesadas de frota/idle para que uma lentidão nesta camada não
// derrube os indicadores comerciais nem devolva 502 para a página inteira.
export default async function (req: Request): Promise<Response> {
  const started = Date.now();
  const executionId = `GROWTH-FLEET-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  let base44: any = null;
  let traceId: string | null = null;
  let source: any = null;
  let periodStart = '';
  let periodEnd = '';

  const trace = async (patch: Record<string, unknown>) => {
    if (!base44) return;
    try {
      const payload = { ...patch, updated_at: new Date().toISOString(), duration_ms: Date.now() - started };
      if (!traceId) {
        const created = await base44.asServiceRole.entities.GrowthExecutionLog.create({
          execution_id: executionId,
          status: 'started',
          step: 'request_received',
          started_at: new Date(started).toISOString(),
          period_start: periodStart,
          period_end: periodEnd,
          ...payload,
        });
        traceId = created?.id || null;
      } else {
        await base44.asServiceRole.entities.GrowthExecutionLog.update(traceId, payload);
      }
    } catch {
      // Telemetria nunca pode derrubar a análise.
    }
  };

  try {
    base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const today = new Date().toISOString().slice(0, 10);
    const defaultStart = new Date(new Date(`${today}T12:00:00Z`).getTime() - 365 * 86400000).toISOString().slice(0, 10);
    const period = resolvePeriod({
      start: body?.start_date,
      endInclusive: body?.end_date,
      endExclusive: body?.end_date_exclusive,
      defaultStart,
      defaultEndInclusive: today,
    });
    periodStart = period.start;
    periodEnd = period.endExclusive;
    await trace({ status: 'started', step: 'period_resolved', period_start: periodStart, period_end: periodEnd });

    source = await resolveSource(base44, body?.source_id);
    if (!source) {
      await trace({ status: 'error', step: 'source_not_found', error_message: 'Nenhuma fonte ERP ativa e utilizável foi encontrada.' });
      return Response.json({ success: false, error: 'Nenhuma fonte ERP ativa e utilizável foi encontrada.' }, { status: 404 });
    }
    await trace({
      status: 'source_resolved',
      step: 'source_resolved',
      source_id: source.id || '',
      source_name: source.name || '',
    });

    const sqlFleet = `WITH locados AS (
      SELECT DISTINCT re.cd_patrimonio
      FROM fl_rem_equ re WITH (NOLOCK)
      INNER JOIN fl_remessa r WITH (NOLOCK) ON r.cd_flremessa = re.cd_flremessa
      INNER JOIN fich_loc f WITH (NOLOCK) ON f.cd_controle = r.cd_controle
      WHERE re.cd_patrimonio > 0
        AND r.dt_saida IS NOT NULL
        AND r.dt_saida < '${period.endExclusive}'
        AND r.dt_saida >= DATEADD(year, -3, CAST('${period.endExclusive}' AS date))
        AND UPPER(COALESCE(r.fl_rem_cancelada,'N')) <> 'S'
        AND COALESCE(re.qt_devolucao,0) < COALESCE(re.qt_remessa,0)
        ${empFilter('f')}
    ),
    frota AS (
      SELECT
        COUNT(*) AS pat_total,
        SUM(COALESCE(vl_aqu_patrimonio,0)) AS vl_frota
      FROM patrimon WITH (NOLOCK)
      WHERE UPPER(COALESCE(fl_vendido,'N')) <> 'S'
    )
    SELECT f.pat_total, f.vl_frota, (SELECT COUNT(*) FROM locados) AS pat_locados
    FROM frota f`;

    const warnings: string[] = [];
    let fleetRow: any = null;
    await trace({ status: 'fleet_query', step: 'fleet_base_started' });
    try {
      fleetRow = rowsOf(await execRead(source, sqlFleet, 14000))[0] || null;
    } catch (error) {
      warnings.push(`Frota e ocupação: ${((error as Error)?.message || String(error)).slice(0, 220)}`);
    }
    await trace({
      status: fleetRow ? 'fleet_query' : 'partial',
      step: fleetRow ? 'fleet_base_completed' : 'fleet_base_failed',
      fleet_rows: fleetRow ? 1 : 0,
      warnings_count: warnings.length,
      warnings_json: JSON.stringify(warnings),
    });

    const sqlIdle = `WITH locados AS (
      SELECT DISTINCT re.cd_patrimonio
      FROM fl_rem_equ re WITH (NOLOCK)
      INNER JOIN fl_remessa r WITH (NOLOCK) ON r.cd_flremessa = re.cd_flremessa
      INNER JOIN fich_loc f WITH (NOLOCK) ON f.cd_controle = r.cd_controle
      WHERE re.cd_patrimonio > 0
        AND r.dt_saida IS NOT NULL
        AND r.dt_saida < '${period.endExclusive}'
        AND UPPER(COALESCE(r.fl_rem_cancelada,'N')) <> 'S'
        AND COALESCE(re.qt_devolucao,0) < COALESCE(re.qt_remessa,0)
        ${empFilter('f')}
    ),
    ultima_entrada AS (
      SELECT
        re.cd_patrimonio,
        MAX(COALESCE(d.dt_entrada, d.dt_devolucao)) AS ultima_entrada
      FROM fl_dev_equ de WITH (NOLOCK)
      INNER JOIN fl_devolucao d WITH (NOLOCK) ON d.cd_fldevolucao = de.cd_fldevolucao
      INNER JOIN fl_rem_equ re WITH (NOLOCK) ON re.cd_flremequ = de.cd_flremequ
      INNER JOIN fl_remessa r WITH (NOLOCK) ON r.cd_flremessa = re.cd_flremessa
      INNER JOIN fich_loc f WITH (NOLOCK) ON f.cd_controle = r.cd_controle
      WHERE re.cd_patrimonio > 0
        AND COALESCE(d.dt_entrada, d.dt_devolucao) IS NOT NULL
        AND COALESCE(d.dt_entrada, d.dt_devolucao) >= DATEADD(month, -24, CAST('${period.endInclusive}' AS date))
        AND COALESCE(d.dt_entrada, d.dt_devolucao) < '${period.endExclusive}'
        AND UPPER(COALESCE(d.fl_dev_cancelada,'N')) <> 'S'
        ${empFilter('f')}
      GROUP BY re.cd_patrimonio
    )
    SELECT
      COUNT(*) AS pat_patio,
      AVG(CAST(DATEDIFF(day, u.ultima_entrada, CAST('${period.endInclusive}' AS date)) AS FLOAT)) AS idle_medio,
      SUM(CASE WHEN DATEDIFF(day, u.ultima_entrada, CAST('${period.endInclusive}' AS date)) > 60 THEN 1 ELSE 0 END) AS idle_60
    FROM ultima_entrada u
    WHERE NOT EXISTS (SELECT 1 FROM locados l WHERE l.cd_patrimonio = u.cd_patrimonio)`;

    let idleRow: any = null;
    // Mantém um teto de execução. Se a frota já consumiu quase toda a janela do gateway,
    // devolvemos os dados disponíveis e deixamos idle como ressalva, em vez de causar 502.
    if (Date.now() - started < 18000) {
      await trace({ status: 'idle_query', step: 'idle_started' });
      try {
        idleRow = rowsOf(await execRead(source, sqlIdle, 7000))[0] || null;
      } catch (error) {
        warnings.push(`Tempo de pátio: ${((error as Error)?.message || String(error)).slice(0, 220)}`);
      }
    } else {
      warnings.push('Tempo de pátio não executado: orçamento de tempo da requisição atingido.');
    }

    const patTotal = fleetRow ? num(fleetRow.pat_total) : null;
    const patLocados = fleetRow ? num(fleetRow.pat_locados) : null;
    const status = warnings.length ? 'partial' : 'success';

    await trace({
      status,
      step: status === 'success' ? 'fleet_completed' : 'fleet_completed_with_warnings',
      fleet_rows: fleetRow ? 1 : 0,
      idle_rows: idleRow ? 1 : 0,
      warnings_count: warnings.length,
      warnings_json: JSON.stringify(warnings),
      completed_at: new Date().toISOString(),
    });

    return Response.json({
      success: !!fleetRow,
      partial: warnings.length > 0,
      execution_id: executionId,
      generated_at: new Date().toISOString(),
      source: { id: source.id || null, name: source.name || null, status: source.status || null },
      period: { start: period.start, end: period.endInclusive },
      frota: {
        pat_total: patTotal,
        vl_frota: fleetRow ? num(fleetRow.vl_frota) : null,
        pat_locados: patLocados,
        ocupacao_pct: patTotal ? (Number(patLocados) / Number(patTotal)) * 100 : null,
        pat_patio: idleRow ? num(idleRow.pat_patio) : null,
        idle_medio: idleRow?.idle_medio == null ? null : Number(idleRow.idle_medio),
        idle_60: idleRow ? num(idleRow.idle_60) : null,
      },
      warnings,
      duration_ms: Date.now() - started,
      queries: [
        { label: 'Frota e ocupação', description: 'patrimon + fl_rem_equ + fl_remessa', sql: sqlFleet },
        { label: 'Tempo de pátio', description: 'última entrada física de devolução de patrimônios atualmente fora de campo', sql: sqlIdle },
      ],
    });
  } catch (error) {
    await trace({
      status: 'error',
      step: 'unhandled_error',
      error_message: (error as Error)?.message || String(error),
      completed_at: new Date().toISOString(),
    });
    return Response.json({ success: false, error: (error as Error)?.message || String(error), execution_id: executionId }, { status: 500 });
  }
}
