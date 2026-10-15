import { crmGet } from './rdCrmOAuth.ts';
import { crmPageParams, parseCrmPage } from './rdCrmSyncSafety.ts';

export const recoveryKey = 'p0-2026-10-15T19:17:03.587Z';
export function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
export async function digest(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(canonical(value)));
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function projectCrm(row, resource) {
  if (resource === 'contacts') return {
    name: row.name || '', email: row.emails?.[0]?.email || '', phone: row.phones?.[0]?.phone || '',
    source_created_at: row.created_at || '',
  };
  const statuses = { won: 'won', lost: 'lost', ongoing: 'open', paused: 'paused' };
  return { name: row.name || '', deal_status: statuses[row.status] || 'open', amount: Number(row.total_price) || 0, source_created_at: row.created_at || '', closed_at: row.closed_at || '' };
}

async function sourcePass(base44, resource, deadline) {
  const rows = new Map();
  let pages = 0;
  for (let page = 1; page <= 100; page++) {
    if (Date.now() > deadline) throw new Error('Tempo de reconciliação excedido; leitura não certificada.');
    const response = await crmGet(base44, resource, crmPageParams(resource, page));
    const parsed = parseCrmPage(response);
    pages++;
    for (const row of parsed.data) {
      const id = String(row.id);
      if (rows.has(id)) throw new Error('ID repetido entre páginas da RD; reconciliação não certificada.');
      rows.set(id, projectCrm(row, resource));
    }
    if (!parsed.more) return { rows, pages };
    // Deliberately sequential and below 120 requests/minute.
    await new Promise(resolve => setTimeout(resolve, 550));
  }
  throw new Error('Limite de 100 páginas atingido; leitura não certificada.');
}

export async function reconcileRecovery(base44, resource) {
  const db = base44.asServiceRole.entities;
  const product = resource === 'contacts' ? 'crm_contact' : 'crm_deal';
  const local = new Map();
  let cursor;
  do {
    const page = await db.RdRecoveryRecord.filter({ recovery_key: recoveryKey, source_entity: 'RdLead', source_product: product }, { limit: 500, ...(cursor ? { cursor } : {}), fields: ['source_record_id', 'content', 'content_sha256'] });
    for (const copy of page.items) {
      if (await digest(copy.content) !== copy.content_sha256) throw new Error('Conteúdo da cópia isolada foi alterado.');
      const id = String(copy.content.external_id || '');
      if (!id || local.has(id)) throw new Error('ID externo ausente ou duplicado na cópia isolada.');
      local.set(id, copy.content);
    }
    if (!page.has_more) break;
    if (!page.next_cursor || page.next_cursor === cursor) throw new Error('Cursor inválido na cópia isolada.');
    cursor = page.next_cursor;
  } while (true);
  const expected = resource === 'contacts' ? 2058 : 3447;
  if (local.size !== expected) throw new Error('Cópia isolada incompleta; reconciliação bloqueada até validar a restauração integral.');
  const startedAt = new Date().toISOString();
  const deadline = Date.now() + 210000;
  const first = await sourcePass(base44, resource, deadline);
  const second = await sourcePass(base44, resource, deadline);
  const ordered = map => [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  const stable = JSON.stringify(ordered(first.rows)) === JSON.stringify(ordered(second.rows));
  const missingLocal = [], missingSource = [], changed = [];
  const fieldCounts = {};
  const population = { open: 0, paused: 0, won: 0, lost: 0 };
  for (const [id, observed] of second.rows) {
    if (resource === 'deals') population[observed.deal_status]++;
    const previous = local.get(id);
    if (!previous) { missingLocal.push(id); continue; }
    const fields = Object.keys(observed).filter(field => {
      if (field === 'amount') return Math.abs(Number(previous[field] || 0) - observed[field]) > 0.005;
      if (['source_created_at', 'closed_at'].includes(field)) {
        const a = previous[field] || '', b = observed[field] || '';
        return a && b ? new Date(a).getTime() !== new Date(b).getTime() : a !== b;
      }
      return String(previous[field] || '') !== String(observed[field] || '');
    });
    if (fields.length) {
      changed.push({ external_id: id, fields });
      for (const field of fields) fieldCounts[field] = (fieldCounts[field] || 0) + 1;
    }
  }
  for (const id of local.keys()) if (!second.rows.has(id)) missingSource.push(id);
  return {
    resource, product, recovery_key: recoveryKey, started_at: startedAt, finished_at: new Date().toISOString(),
    two_source_passes_stable: stable, source_pages_per_pass: [first.pages, second.pages], snapshot_records: local.size,
    source_distinct_records: second.rows.size, missing_in_snapshot: missingLocal.length, missing_in_source: missingSource.length,
    changed_records: changed.length, changed_fields: fieldCounts, ...(resource === 'deals' ? { source_status_population: population } : {}),
    parity: stable && !missingLocal.length && !missingSource.length && !changed.length,
    compared_fields: resource === 'contacts' ? ['name', 'email', 'phone', 'source_created_at'] : ['name', 'deal_status', 'amount', 'source_created_at', 'closed_at'],
    excluded_fields: ['ERP matching and attributed revenue', 'custom fields', 'product line items', 'owner/pipeline/stage and organization lookups'],
    limitations: ['Two stable passes are observational, not a transactional snapshot.', 'Comparison is against the backup timestamp, not a claim that all differences are ingestion defects.', 'Original Base44 IDs are retained inside the copy, not reassigned to native record IDs.'],
    discrepancies: { missing_in_snapshot: missingLocal, missing_in_source: missingSource, changed },
    commercial_record_writes: 0, external_writes: 0, reprocessing_started: false,
  };
}