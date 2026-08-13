import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { execRead } from '../../shared/erpConnection.ts';
import { METRICS, type AnalysisContext } from '../../shared/metricRegistry.ts';

// Phase 4 · Reconciliação legado × canônico (regra de migração: nada substitui o legado sem paralelo documentado).
// Legado = ErpSnapshot.annual_evolution (o que os dashboards atuais exibem).
// Canônico = registry executável via as mesmas queries de computeMetric.
function classify(diffPct: number | null) {
  if (diffPct == null) return 'no_legacy';
  const a = Math.abs(diffPct);
  if (a <= 0.5) return 'match';
  if (a <= 2) return 'warn';
  return 'fail';
}

export default async function (req: Request): Promise<Response> {
  const started = Date.now();
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Apenas administradores.' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const year = Number(body?.year) || new Date().getUTCFullYear();
    const period_start = `${year}-01-01`;
    const period_end = `${year + 1}-01-01`;

    let source = null;
    if (body?.source_id) {
      source = await base44.asServiceRole.entities.ErpDataSource.get(body.source_id);
    } else {
      const list = await base44.asServiceRole.entities.ErpDataSource.filter({ credential_reference: 'env' });
      source = list?.[0] || null;
    }
    if (!source) return Response.json({ error: 'Fonte de dados não encontrada.' }, { status: 404 });

    const snaps = await base44.asServiceRole.entities.ErpSnapshot.filter({ source_id: source.id, is_current: true });
    const snapshot = snaps?.[0] || null;
    const legacyRow = (snapshot?.annual_evolution || []).find((r: any) => Number(r.ano) === year) || null;

    // Contrapartes legadas disponíveis no snapshot consolidado
    const legacyMap: Record<string, { value: number | null; source: string }> = {
      'MTR-001': { value: legacyRow ? Number(legacyRow.fat_total) : null, source: 'ErpSnapshot.annual_evolution.fat_total' },
      'MTR-017': { value: legacyRow ? Number(legacyRow.clientes) : null, source: 'ErpSnapshot.annual_evolution.clientes' },
      'MTR-006': {
        value: legacyRow && Number(legacyRow.clientes) ? Number(legacyRow.fat_total) / Number(legacyRow.clientes) : null,
        source: 'ErpSnapshot.annual_evolution.fat_total / .clientes',
      },
    };

    const ctx: AnalysisContext = { source_id: source.id, period_start, period_end, cd_empresa: null, comparison_mode: 'none' };
    const results = [];

    for (const metric of METRICS) {
      const plan = metric.build(ctx);
      const rows: any[][] = [];
      for (const q of plan.queries) {
        const res = await execRead(source, q, 60000);
        rows.push(res.recordset || []);
      }
      const canonical = plan.reduce(rows);
      const legacy = legacyMap[metric.metric_id] || { value: null, source: 'sem contraparte legada' };
      const diff = legacy.value != null && canonical != null ? canonical - legacy.value : null;
      const diffPct = legacy.value ? Math.round(((diff as number) / legacy.value) * 10000) / 100 : null;

      results.push({
        source_id: source.id,
        source_name: source.name,
        metric_id: metric.metric_id,
        business_name: metric.business_name,
        registry_version: metric.version,
        period_start,
        period_end,
        cd_empresa: '',
        unit: metric.unit,
        legacy_value: legacy.value,
        legacy_source: legacy.source,
        canonical_value: canonical,
        diff,
        diff_pct: diffPct,
        status: classify(diffPct),
        approved: false,
        queries: plan.queries,
        snapshot_version: snapshot?.version || '',
        run_at: new Date().toISOString(),
        generated_by_name: user.full_name || user.email,
        duration_ms: Date.now() - started,
      });
    }

    // Substitui a apuração anterior da mesma fonte/janela (histórico é o ErpSnapshot, não a reconciliação)
    const previous = await base44.asServiceRole.entities.MetricReconciliation.filter({
      source_id: source.id,
      period_start,
      period_end,
    });
    for (const p of previous) await base44.asServiceRole.entities.MetricReconciliation.delete(p.id);
    const saved = await base44.asServiceRole.entities.MetricReconciliation.bulkCreate(results);

    return Response.json({
      source: { id: source.id, name: source.name },
      period: { start: period_start, end: period_end },
      snapshot_version: snapshot?.version || null,
      legacy_available: !!legacyRow,
      summary: {
        total: results.length,
        match: results.filter((r) => r.status === 'match').length,
        warn: results.filter((r) => r.status === 'warn').length,
        fail: results.filter((r) => r.status === 'fail').length,
        no_legacy: results.filter((r) => r.status === 'no_legacy').length,
      },
      results: saved || results,
      duration_ms: Date.now() - started,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}