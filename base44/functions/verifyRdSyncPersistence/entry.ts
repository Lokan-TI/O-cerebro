import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { persistCrmRecords, verifyCrmRun } from '../../shared/rdCrmSyncSafety.ts';

// Temporary verification harness; only operates on this test's throwaway record.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json();
    if (!body.fixture_id) return Response.json({ error: 'Fixture required' }, { status: 400 });
    const db = base44.asServiceRole.entities;
    const row = await db.RdLead.get(body.fixture_id);
    if (!row?.external_key?.startsWith(`verification:rd-sync:${user.id}:`) || row.product !== 'crm_deal') return Response.json({ error: 'Not a verification record' }, { status: 403 });
    const incoming = { external_key: row.external_key, product: row.product, identity_email: row.identity_email || '', identity_phone: row.identity_phone || '', identity_doc: row.identity_doc || '', match_status: 'pending', amount: 2 };
    if (body.change_identity) incoming.identity_email = 'changed@example.invalid';
    try {
      await persistCrmRecords(db, [incoming], row.external_key, new Date().toISOString());
    } catch (error) {
      return Response.json({ blocked: true, message: error.message });
    }
    return Response.json({ blocked: false, integrity: await verifyCrmRun(db, row.external_key, 1) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}