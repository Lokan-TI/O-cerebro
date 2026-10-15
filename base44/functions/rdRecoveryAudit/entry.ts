import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { recoveryKey, reconcileRecovery } from '../../shared/rdRecoveryCompare.ts';
import { loadRdOverrides, assertActive } from '../../shared/rdConfig.ts';

// Recovery copies only: no call to the live sync or matching persistence paths.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json();
    if (body.action === 'status') {
      const counts = await base44.asServiceRole.entities.RdRecoveryRecord.aggregate({ query: { recovery_key: recoveryKey }, groupBy: 'source_entity' });
      return Response.json({ recovery_key: recoveryKey, copies: counts.rows, commercial_record_writes: 0 });
    }
    if (body.action !== 'reconcile' || !['contacts', 'deals'].includes(body.resource)) return Response.json({ error: 'Ação ou recurso inválido.' }, { status: 400 });
    await loadRdOverrides(base44);
    assertActive('crm');
    const report = await reconcileRecovery(base44, body.resource);
    const file = await base44.asServiceRole.integrations.Core.UploadPrivateFile({ file: new File([JSON.stringify(report, null, 2)], `p0_rd_reconciliation_${body.resource}_2026-10-15.json`, { type: 'application/json' }) });
    const { discrepancies, ...summary } = report;
    return Response.json({ ...summary, evidence_file_uri: file.file_uri });
  } catch (error) {
    return Response.json({ error: error.message, certified: false, reprocessing_started: false }, { status: 500 });
  }
}