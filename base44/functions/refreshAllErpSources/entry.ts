import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

// Rotina diária: atualiza TODAS as fontes ERP ativas. Cada fonte roda isolada
// (falha de uma não interrompe as outras) e o resultado por fonte é registrado.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const year = new Date().getUTCFullYear();
    const period = { start_date: `${year}-01-01`, end_date_exclusive: `${year + 1}-01-01` };
    const sources = (await base44.asServiceRole.entities.ErpDataSource.list()).filter((s: any) => s.is_active !== false);

    const results = await Promise.allSettled(sources.map(async (s: any) => {
      const t0 = Date.now();
      const res = await base44.asServiceRole.functions.invoke('refreshErpData', { source_id: s.id, ...period });
      const data = res?.data ?? res;
      return { source: s.name, source_id: s.id, status: data?.status || (data?.success ? 'success' : 'failed'), version: data?.version || null, message: data?.message || data?.error || null, duration_ms: Date.now() - t0 };
    }));
    const perSource = results.map((r, i) => r.status === 'fulfilled'
      ? r.value
      : { source: sources[i].name, source_id: sources[i].id, status: 'failed', message: String((r as any).reason?.message || (r as any).reason).slice(0, 300) });

    await base44.asServiceRole.entities.GovernanceLog.create({
      governance_id: `GOV-REFRESH-ALL-${new Date().toISOString().slice(0, 16)}`,
      action_type: 'VALIDATE',
      entity_type: 'ErpSnapshot',
      entity_id: 'all_sources',
      description: perSource.map((p: any) => `${p.source}: ${p.status}${p.version ? ` (${p.version})` : ''}${p.message && p.status !== 'success' ? ` — ${p.message}` : ''}`).join(' | '),
      performed_by: 'refreshAllErpSources',
      performed_at: new Date().toISOString(),
      validation_status: perSource.every((p: any) => p.status === 'success' || p.status === 'partial') ? 'VERIFIED' : 'PENDING',
      impact_level: 'LOW',
    });
    return Response.json({ success: true, sources: perSource });
  } catch (error) {
    return Response.json({ error: (error as any)?.message || String(error) }, { status: 500 });
  }
}