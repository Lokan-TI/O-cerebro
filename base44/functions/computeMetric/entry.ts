import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { execRead } from '../../shared/erpConnection.ts';
import { METRICS, getMetric, comparisonWindow, type AnalysisContext } from '../../shared/metricRegistry.ts';

// Phase 4 · Metric Layer. Única porta de cálculo de métrica oficial.
// AnalysisContext obrigatório. Toda resposta carrega selo de confiança e a SQL executada (lineage).
export default async function (req: Request): Promise<Response> {
  const started = Date.now();
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));

    if (body?.list_only) {
      return Response.json({
        registry_version: '0.1',
        metrics: METRICS.map(({ build, ...meta }) => meta),
      });
    }

    const metric = getMetric(body?.metric_id);
    if (!metric) return Response.json({ error: `Métrica "${body?.metric_id}" não existe no registry.` }, { status: 404 });

    const ctx: AnalysisContext = {
      source_id: body?.source_id,
      period_start: body?.period_start,
      period_end: body?.period_end,
      cd_empresa: body?.cd_empresa || null,
      comparison_mode: body?.comparison_mode || 'none',
    };
    if (!ctx.period_start || !ctx.period_end) {
      return Response.json({ error: 'AnalysisContext incompleto: period_start e period_end são obrigatórios.' }, { status: 400 });
    }

    let source = null;
    if (ctx.source_id) {
      source = await base44.asServiceRole.entities.ErpDataSource.get(ctx.source_id);
    } else {
      const list = await base44.asServiceRole.entities.ErpDataSource.filter({ credential_reference: 'env' });
      source = list?.[0] || null;
    }
    if (!source) return Response.json({ error: 'Fonte de dados não encontrada.' }, { status: 404 });

    const run = async (c: AnalysisContext) => {
      const plan = metric.build(c);
      const results: any[][] = [];
      for (const q of plan.queries) {
        const res = await execRead(source, q, 60000);
        results.push(res.recordset || []);
      }
      return { value: plan.reduce(results), queries: plan.queries };
    };

    const current = await run(ctx);
    const cmpWindow = comparisonWindow(ctx);
    let comparison = null;
    if (cmpWindow) {
      const prior = await run({ ...ctx, period_start: cmpWindow.period_start, period_end: cmpWindow.period_end });
      const delta = current.value != null && prior.value != null ? current.value - prior.value : null;
      comparison = {
        mode: ctx.comparison_mode,
        label: cmpWindow.label,
        period: { start: cmpWindow.period_start, end: cmpWindow.period_end },
        value: prior.value,
        delta,
        delta_pct: prior.value ? Math.round((delta! / prior.value) * 1000) / 10 : null,
      };
    }

    return Response.json({
      metric: {
        metric_id: metric.metric_id,
        business_name: metric.business_name,
        version: metric.version,
        formula: metric.formula,
        grain: metric.grain,
        unit: metric.unit,
        time_dimension: metric.time_dimension,
        business_owner: metric.business_owner,
        technical_owner: metric.technical_owner,
        source_of_truth: metric.source_of_truth,
      },
      analysis_context: { ...ctx, source_name: source.name },
      value: current.value,
      comparison,
      trust: {
        trusted: metric.trusted,
        badge: metric.trusted ? 'OFICIAL' : 'NÃO OFICIAL',
        blocking_questions: metric.blocking_questions,
      },
      lineage: { queries: current.queries },
      query_count: current.queries.length * (cmpWindow ? 2 : 1),
      duration_ms: Date.now() - started,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}