import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

// Rotina diária (F2): atualiza UMA fonte ERP ativa por chamada (índice na lista ordenada
// por nome). O workflow chama índices 0..N em sequência, então falha/timeout de uma fonte
// nunca interrompe as demais e as fontes não disputam o banco em paralelo.
// Resultado por fonte registrado no GovernanceLog.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const index = Number(body?.index) || 0;
    const sources = (await base44.asServiceRole.entities.ErpDataSource.list())
      .filter((s: any) => s.is_active !== false)
      .sort((a: any, b: any) => String(a.name).localeCompare(String(b.name)));
    const s = sources[index];
    if (!s) return Response.json({ success: true, skipped: true, index, total: sources.length });

    const year = new Date().getUTCFullYear();
    const startedAt = new Date().toISOString();
    let dispatchError: string | null = null;
    try {
      await base44.asServiceRole.functions.invoke('refreshErpData', {
        source_id: s.id, start_date: `${year}-01-01`, end_date_exclusive: `${year + 1}-01-01`,
      });
    } catch (e) {
      // 524 = gateway encerrou a espera HTTP; o refresh segue no servidor. Acompanha pelo ErpSyncRun.
      dispatchError = String((e as any)?.message || e).slice(0, 200);
    }

    let run: any = null;
    for (let i = 0; i < 40; i++) {
      const runs = await base44.asServiceRole.entities.ErpSyncRun.filter({ source_id: s.id, started_at: { $gte: startedAt } }, '-started_at', 1);
      run = runs?.[0] || null;
      if (run && run.status !== 'running') break;
      if (!run && dispatchError && !/524/.test(dispatchError)) break;
      await sleep(5000);
    }
    const status = run?.status || 'failed';
    const message = run?.error_message || (run ? null : dispatchError) || (status === 'running' ? 'Ainda em execução ao fim da espera.' : null);

    await base44.asServiceRole.entities.GovernanceLog.create({
      governance_id: `GOV-REFRESH-${String(s.name).toUpperCase()}-${startedAt.slice(0, 16)}`,
      action_type: 'VALIDATE',
      entity_type: 'ErpSnapshot',
      entity_id: s.id,
      description: `Refresh diário ${s.name}: ${status}${run?.max_date ? ` (dados até ${run.max_date})` : ''}${message ? ` — ${message}` : ''}`,
      performed_by: 'refreshAllErpSources',
      performed_at: new Date().toISOString(),
      validation_status: status === 'success' || status === 'partial' ? 'VERIFIED' : 'PENDING',
      impact_level: status === 'success' || status === 'partial' ? 'LOW' : 'HIGH',
    });
    return Response.json({ success: true, index, source: s.name, status, message });
  } catch (error) {
    return Response.json({ error: (error as any)?.message || String(error) }, { status: 500 });
  }
}