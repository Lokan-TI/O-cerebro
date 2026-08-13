import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { METRICS } from '../../shared/metricRegistry.ts';

// Phase 4 · DatasetRelease atômico — congela snapshot + registry + reconciliação em uma versão publicável.
// Regra de migração: nada é publicado com divergência fail sem justificativa aceita.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Apenas administradores.' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const dryRun = !!body?.dry_run;
    const year = Number(body?.year) || new Date().getUTCFullYear();
    const period_start = `${year}-01-01`;
    const period_end = `${year + 1}-01-01`;

    let source = null;
    if (body?.source_id) source = await base44.asServiceRole.entities.ErpDataSource.get(body.source_id);
    else source = (await base44.asServiceRole.entities.ErpDataSource.filter({ credential_reference: 'env' }))?.[0] || null;
    if (!source) return Response.json({ error: 'Fonte de dados não encontrada.' }, { status: 404 });

    const [snaps, recons, partyReports, onboardings] = await Promise.all([
      base44.asServiceRole.entities.ErpSnapshot.filter({ source_id: source.id, is_current: true }),
      base44.asServiceRole.entities.MetricReconciliation.filter({ source_id: source.id, period_start, period_end }),
      base44.asServiceRole.entities.PartyResolutionReport.filter({ source_id: source.id, is_current: true }),
      base44.asServiceRole.entities.SourceOnboardingReport.filter({ source_id: source.id, is_current: true }),
    ]);
    const snapshot = snaps?.[0] || null;
    const party = partyReports?.[0] || null;
    const onboarding = onboardings?.[0] || null;

    const fails = (recons || []).filter((r: any) => r.status === 'fail');
    const unjustified = fails.filter((r: any) => !r.approved || !r.justification);

    const gates = [
      {
        id: 'snapshot',
        label: 'Snapshot vigente publicado',
        passed: !!snapshot,
        detail: snapshot ? `Versão ${snapshot.version} · até ${snapshot.max_date || '—'}` : 'Nenhum snapshot is_current para a fonte.',
      },
      {
        id: 'reconciliation',
        label: `Reconciliação apurada para ${year}`,
        passed: (recons || []).length > 0,
        detail: (recons || []).length ? `${recons.length} métricas comparadas` : 'Execute a reconciliação legado × canônico antes de publicar.',
      },
      {
        id: 'divergences',
        label: 'Divergências acima de 2% justificadas e aceitas',
        passed: unjustified.length === 0,
        detail: unjustified.length
          ? `Pendentes: ${unjustified.map((r: any) => r.metric_id).join(', ')}`
          : fails.length
            ? `${fails.length} divergência(s) aceita(s) com justificativa`
            : 'Sem divergências acima da tolerância',
      },
      {
        id: 'identity',
        label: 'Identidade (Party) resolvida com cobertura de documento ≥ 95%',
        passed: !!party && Number(party.document_coverage) >= 95,
        detail: party ? `Cobertura ${Number(party.document_coverage).toFixed(1)}% · versão ${party.version}` : 'Nenhum relatório de identidade vigente.',
      },
      {
        id: 'source_trust',
        label: 'Onboarding da fonte com trust score ≥ 60',
        passed: !!onboarding && Number(onboarding.trust_score) >= 60,
        detail: onboarding ? `Trust score ${onboarding.trust_score} · versão ${onboarding.version}` : 'Nenhum relatório de onboarding vigente.',
      },
    ];
    const blocking_reasons = gates.filter((g) => !g.passed).map((g) => `${g.label}: ${g.detail}`);
    const gates_passed = blocking_reasons.length === 0;

    const payload = {
      source_id: source.id,
      source_name: source.name,
      version: `REL-${String(source.name || 'FONTE').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)}-${new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)}`,
      status: gates_passed ? 'published' : 'blocked',
      is_current: gates_passed,
      published_at: new Date().toISOString(),
      published_by_name: user.full_name || user.email,
      snapshot_version: snapshot?.version || '',
      snapshot_max_date: snapshot?.max_date || '',
      reconciliation_period_start: period_start,
      reconciliation_period_end: period_end,
      registry_versions: METRICS.map((m) => ({
        metric_id: m.metric_id,
        business_name: m.business_name,
        version: m.version,
        trusted: m.trusted,
        unit: m.unit,
      })),
      gates,
      gates_passed,
      blocking_reasons,
      metrics_total: (recons || []).length,
      metrics_match: (recons || []).filter((r: any) => r.status === 'match').length,
      metrics_warn: (recons || []).filter((r: any) => r.status === 'warn').length,
      metrics_fail: fails.length,
      metrics_unjustified: unjustified.length,
      party_report_version: party?.version || '',
      party_document_coverage: party ? Number(party.document_coverage) : 0,
      onboarding_trust_score: onboarding ? Number(onboarding.trust_score) : 0,
      notes: body?.notes || '',
    };

    if (dryRun) return Response.json({ dry_run: true, release: payload });

    // Publicação atômica: só rebaixa a release anterior quando a nova passa em todos os gates.
    if (gates_passed) {
      const current = await base44.asServiceRole.entities.DatasetRelease.filter({ source_id: source.id, is_current: true });
      for (const c of current) {
        await base44.asServiceRole.entities.DatasetRelease.update(c.id, { is_current: false, status: 'superseded' });
      }
    }
    const created = await base44.asServiceRole.entities.DatasetRelease.create(payload);

    return Response.json({ dry_run: false, release: created });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}