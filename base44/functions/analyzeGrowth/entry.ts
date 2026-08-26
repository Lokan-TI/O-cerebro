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

// Visão comercial essencial de Growth.
//
// Esta função foi deliberadamente reduzida a UMA consulta ao SISLOC. A versão anterior
// executava sete consultas pesadas em sequência; em caso de lentidão cada uma podia aguardar
// até 25 segundos, excedendo a janela do gateway Base44 e produzindo HTTP 502 antes de a
// função conseguir devolver os avisos. Frota e idle time são carregados separadamente por
// analyzeGrowthFleet, sem impedir a renderização desta visão principal.
export default async function (req: Request): Promise<Response> {
  const started = Date.now();
  const executionId = `GROWTH-CORE-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
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
      // Telemetria nunca pode derrubar o indicador.
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

    const sqlCore = `WITH demanda AS (
      SELECT
        COUNT(*) AS propostas,
        SUM(CASE WHEN dt_aprovacao IS NOT NULL THEN 1 ELSE 0 END) AS aprovadas,
        SUM(CASE WHEN dt_enc_ficha IS NOT NULL THEN 1 ELSE 0 END) AS encerradas,
        SUM(CASE WHEN dt_enc_ficha IS NULL AND UPPER(COALESCE(fl_baixada,'N')) <> 'S' THEN 1 ELSE 0 END) AS ativas,
        COUNT(DISTINCT cd_pessoa) AS clientes,
        SUM(COALESCE(vl_minimo_locacao,0)) AS vl_minimo,
        AVG(CASE WHEN dt_aprovacao IS NOT NULL
          THEN CAST(DATEDIFF(day, dt_pedido, dt_aprovacao) AS FLOAT) END) AS dias_aprovacao
      FROM fich_loc WITH (NOLOCK)
      WHERE dt_pedido >= '${period.start}' AND dt_pedido < '${period.endExclusive}'
        ${empFilter()}
    ),
    ativacao AS (
      SELECT
        COUNT(DISTINCT r.cd_controle) AS fichas_com_saida,
        COUNT(*) AS remessas,
        COUNT(DISTINCT f.cd_pessoa) AS clientes_atendidos
      FROM fl_remessa r WITH (NOLOCK)
      INNER JOIN fich_loc f WITH (NOLOCK) ON f.cd_controle = r.cd_controle
      WHERE r.dt_saida >= '${period.start}' AND r.dt_saida < '${period.endExclusive}'
        AND UPPER(COALESCE(r.fl_rem_cancelada,'N')) <> 'S'
        ${empFilter('f')}
    ),
    devolucoes AS (
      SELECT
        COUNT(*) AS devolucoes,
        COUNT(DISTINCT d.cd_controle) AS fichas_devolvidas
      FROM fl_devolucao d WITH (NOLOCK)
      INNER JOIN fich_loc f WITH (NOLOCK) ON f.cd_controle = d.cd_controle
      WHERE d.dt_devolucao >= '${period.start}' AND d.dt_devolucao < '${period.endExclusive}'
        AND UPPER(COALESCE(d.fl_dev_cancelada,'N')) <> 'S'
        ${empFilter('f')}
    ),
    receita AS (
      SELECT
        COUNT(*) AS qtd_faturas,
        SUM(COALESCE(fat.vl_fatura,0)) AS vl_gerado
      FROM fl_fatura fat WITH (NOLOCK)
      INNER JOIN fich_loc f WITH (NOLOCK) ON f.cd_controle = fat.cd_controle
      WHERE fat.dt_geracao >= '${period.start}' AND fat.dt_geracao < '${period.endExclusive}'
        ${empFilter('f')}
    )
    SELECT
      d.propostas, d.aprovadas, d.encerradas, d.ativas, d.clientes, d.vl_minimo, d.dias_aprovacao,
      a.fichas_com_saida, a.remessas, a.clientes_atendidos,
      v.devolucoes, v.fichas_devolvidas,
      r.qtd_faturas, r.vl_gerado
    FROM demanda d
    CROSS JOIN ativacao a
    CROSS JOIN devolucoes v
    CROSS JOIN receita r`;

    await trace({ status: 'core_query', step: 'commercial_core_started' });
    let row: any = null;
    const warnings: string[] = [];
    try {
      const result = await execRead(source, sqlCore, 18000);
      row = rowsOf(result)[0] || null;
    } catch (error) {
      warnings.push(`Núcleo comercial: ${((error as Error)?.message || String(error)).slice(0, 220)}`);
    }

    if (!row) {
      await trace({
        status: 'error',
        step: 'commercial_core_failed',
        core_rows: 0,
        warnings_count: warnings.length,
        warnings_json: JSON.stringify(warnings),
        error_message: warnings[0] || 'Consulta comercial sem retorno.',
        completed_at: new Date().toISOString(),
      });
      return Response.json({
        success: false,
        error: warnings[0] || 'O SISLOC não retornou os indicadores comerciais.',
        warnings,
        source: { id: source.id || null, name: source.name || null, status: source.status || null },
        period: { start: period.start, end: period.endInclusive },
        execution_id: executionId,
      });
    }

    const propostas = num(row.propostas);
    const aprovadas = num(row.aprovadas);
    const fichasComSaida = num(row.fichas_com_saida);
    const receita = num(row.vl_gerado);
    const clientesAtendidos = num(row.clientes_atendidos);

    const payload = {
      success: true,
      partial: true,
      execution_id: executionId,
      generated_at: new Date().toISOString(),
      source: { id: source.id || null, name: source.name || null, status: source.status || null },
      period: { start: period.start, end: period.endInclusive },
      demanda: {
        propostas,
        aprovadas,
        aprovacao_pct: propostas ? (aprovadas / propostas) * 100 : null,
        ativadas: fichasComSaida,
        ativacao_pct: propostas ? (fichasComSaida / propostas) * 100 : null,
        dias_aprovacao: row.dias_aprovacao == null ? null : Number(row.dias_aprovacao),
        clientes: num(row.clientes),
        clientes_atendidos: clientesAtendidos,
        ticket_contrato: fichasComSaida ? receita / fichasComSaida : null,
        ativas: num(row.ativas),
        encerradas: num(row.encerradas),
      },
      frota: {
        pat_total: null,
        vl_frota: null,
        pat_locados: null,
        ocupacao_pct: null,
        remessas: num(row.remessas),
        devolucoes: num(row.devolucoes),
        pat_patio: null,
        idle_medio: null,
        idle_60: null,
      },
      receita: {
        vl_gerado: receita,
        qtd_faturas: num(row.qtd_faturas),
        revpae: null,
        receita_por_patrimonio: null,
        receita_por_cliente: clientesAtendidos ? receita / clientesAtendidos : null,
      },
      warnings,
      duration_ms: Date.now() - started,
      queries: [{
        label: 'Núcleo comercial de Growth',
        description: 'fich_loc + fl_remessa + fl_devolucao + fl_fatura em uma única consulta',
        sql: sqlCore,
      }],
    };

    await trace({
      status: warnings.length ? 'partial' : 'success',
      step: 'commercial_core_completed',
      core_rows: 1,
      warnings_count: warnings.length,
      warnings_json: JSON.stringify(warnings),
      completed_at: new Date().toISOString(),
    });

    return Response.json(payload);
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
