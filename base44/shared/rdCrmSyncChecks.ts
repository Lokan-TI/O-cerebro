import { crmPageParams, parseCrmPage, persistCrmRecords, verifyCrmRun } from './rdCrmSyncSafety.ts';

// Isolated regression checks: no credentials, network calls or production writes.
function memoryStore(seed = []) {
  const rows = structuredClone(seed);
  let writes = 0;
  const entity = {
    async filter(query) { return { items: rows.filter((row) => query.external_key.$in.includes(row.external_key)), has_more: false }; },
    async upsert(batch) {
      writes++;
      for (const item of batch) {
        const previous = rows.find((row) => row.external_key === item.external_key);
        if (previous) Object.assign(previous, structuredClone(item));
        else rows.push(structuredClone(item));
      }
    },
    async count(query) { return rows.filter((row) => row.run_id === query.run_id && query.product.$in.includes(row.product)).length; },
  };
  return { db: { RdLead: entity }, rows, get writes() { return writes; } };
}

export async function runCrmSyncChecks() {
  const checks = [];
  const assert = (condition) => { if (!condition) throw new Error('Assertion failed'); };
  const rejects = async (action) => { let rejected = false; try { await action(); } catch { rejected = true; } assert(rejected); };
  const check = async (name, action) => { try { await action(); checks.push({ name, passed: true }); } catch (error) { checks.push({ name, passed: false, error: error.message }); } };
  const lead = { external_key: 'crm_deal:fixture', product: 'crm_deal', identity_email: 'fixture@example.invalid', identity_phone: '', identity_doc: '', match_status: 'pending', amount: 10 };
  const now = '2026-10-15T00:00:00.000Z';
  await check('deals_ordered_by_creation', () => assert(crmPageParams('deals', 2)['sort[created_at]'] === 'asc' && crmPageParams('deals', 2)['page[number]'] === '2'));
  await check('lookup_parameters_preserved', () => assert(!('sort[created_at]' in crmPageParams('users', 1))));
  await check('explicit_last_page_respected', () => assert(!parseCrmPage({ data: [{ id: 'a' }], links: { next: null } }, 1).more));
  await check('missing_link_falls_back_to_page_size', () => assert(parseCrmPage({ data: [{ id: 'a' }] }, 1).more));
  await check('invalid_response_does_not_finish', () => rejects(() => parseCrmPage({ error: 'bad response' })));
  await check('duplicate_source_ids_block_page', () => rejects(() => parseCrmPage({ data: [{ id: 'a' }, { id: 'a' }] })));
  await check('missing_source_id_blocks_page', () => rejects(() => parseCrmPage({ data: [{}] })));
  await check('empty_page_with_next_blocks_page', () => rejects(() => parseCrmPage({ data: [], links: { next: '/next' } })));
  await check('new_record_pending_and_replay_idempotent', async () => {
    const store = memoryStore();
    await persistCrmRecords(store.db, [lead], 'run', now);
    await persistCrmRecords(store.db, [lead], 'run', now);
    assert(store.rows.length === 1 && store.rows[0].match_status === 'pending');
    assert((await verifyCrmRun(store.db, 'run', 1)).complete);
  });
  for (const status of ['manual', 'rejected', 'matched', 'ambiguous', 'unmatched', 'no_identity']) {
    await check(`${status}_preserved_when_identity_unchanged`, async () => {
      const previous = { ...lead, match_status: status, erp_cd_pessoa: 'fixture-person', erp_receita_pos_lead: 100 };
      const store = memoryStore([previous]);
      await persistCrmRecords(store.db, [{ ...lead, amount: 20 }], 'run', now);
      assert(store.rows[0].match_status === status && store.rows[0].erp_cd_pessoa === 'fixture-person' && store.rows[0].erp_receita_pos_lead === 100 && store.rows[0].amount === 20);
    });
  }
  for (const status of ['manual', 'rejected']) {
    await check(`${status}_changed_identity_blocks_entire_batch`, async () => {
      const store = memoryStore([{ ...lead, match_status: status }]);
      await rejects(() => persistCrmRecords(store.db, [{ ...lead, external_key: 'crm_deal:new' }, { ...lead, identity_email: 'changed@example.invalid' }], 'run', now));
      assert(store.writes === 0 && store.rows.length === 1 && store.rows[0].identity_email === lead.identity_email);
    });
  }
  await check('pending_manual_decision_also_protected', async () => {
    const store = memoryStore([{ ...lead, match_method: 'manual' }]);
    await rejects(() => persistCrmRecords(store.db, [{ ...lead, identity_phone: 'changed' }], 'run', now));
    assert(store.writes === 0);
  });
  await check('automatic_changed_identity_clears_stale_enrichment', async () => {
    const store = memoryStore([{ ...lead, match_status: 'matched', erp_cd_pessoa: 'old', erp_receita_total: 100, erp_receita_pos_lead: 80, matched_at: now }]);
    await persistCrmRecords(store.db, [{ ...lead, identity_email: 'changed@example.invalid' }], 'run', now);
    assert(store.rows[0].match_status === 'pending' && store.rows[0].erp_cd_pessoa === '' && store.rows[0].erp_receita_total === 0 && store.rows[0].erp_receita_pos_lead === 0 && store.rows[0].matched_at === '');
  });
  await check('duplicate_local_keys_block_writes', async () => {
    const store = memoryStore([lead, lead]);
    await rejects(() => persistCrmRecords(store.db, [lead], 'run', now));
    assert(store.writes === 0);
  });
  await check('incomplete_existing_page_blocks_writes', async () => {
    const store = memoryStore();
    store.db.RdLead.filter = async () => ({ items: [], has_more: true });
    await rejects(() => persistCrmRecords(store.db, [lead], 'run', now));
    assert(store.writes === 0);
  });
  await check('repeated_pages_not_certified_complete', async () => {
    const store = memoryStore([{ ...lead, run_id: 'run' }]);
    const result = await verifyCrmRun(store.db, 'run', 2);
    assert(!result.complete && result.distinct_stored === 1 && result.rows_read === 2);
  });
  await check('other_runs_excluded_from_integrity', async () => {
    const store = memoryStore([{ ...lead, run_id: 'other' }]);
    assert((await verifyCrmRun(store.db, 'run', 0)).complete);
  });
  return { ok: checks.every((item) => item.passed), isolated: true, production_writes: false, checks };
}