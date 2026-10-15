import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { fetchPage, initialCursor, rdErrorHint } from '../../shared/rdSync.ts';
import { ensureAccessToken } from '../../shared/rdOAuth.ts';
import { crmGet } from '../../shared/rdCrmOAuth.ts';
import { rdRead } from '../../shared/rdStation.ts';
import { loadRdOverrides, rdOverride, rdToken } from '../../shared/rdConfig.ts';
import { crmPaginationVersion, persistCrmRecords, verifyCrmRun } from '../../shared/rdCrmSyncSafety.ts';
import { runCrmSyncChecks } from '../../shared/rdCrmSyncChecks.ts';

// Ações: test (valida credencial do produto) · step (executa/retoma um passo da sincronização).
// Rotas de validação documentadas: CRM v1 token/check · Marketing segmentações · Conversas v2 employees.
const TESTS: Record<string, [string, string, Record<string, unknown>]> = {
  crm: ['crm', 'token/check', {}],
  marketing: ['marketing', 'platform/segmentations', { page: 1, page_size: 1 }],
  conversas: ['conversas', 'employees', {}],
};

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Restrito a administradores.' }, { status: 403 });
    const b = await req.json().catch(() => ({}));
    const product = String(b.product || '');
    if (!['crm', 'marketing', 'conversas'].includes(product)) return Response.json({ error: 'Produto inválido.' }, { status: 400 });
    const db = base44.asServiceRole.entities;
    if (b.action === 'validate' && product === 'crm') return Response.json(await runCrmSyncChecks());
    if (b.action && !['test', 'step'].includes(b.action)) return Response.json({ error: 'Ação inválida.' }, { status: 400 });
    await loadRdOverrides(base44);
    if (rdOverride(product)?.removed) return Response.json({ error: 'Conexão removida. Restaure-a para voltar a usar.' }, { status: 409 });

    if (b.action === 'test') {
      try {
        if (product === 'crm') {
          await crmGet(base44, 'users', { 'page[size]': '1' });
          return Response.json({ ok: true, status: 200, message: 'Conexão válida (API CRM v2)' });
        }
        const [p, path, params] = TESTS[product];
        let bearer: string | undefined;
        if (product === 'marketing') {
          try { bearer = await ensureAccessToken(base44); }
          catch (e) { return Response.json({ ok: false, status: 0, message: `${e.message} Clique em "Autorizar na RD Station" (etapa 3) e teste de novo.` }); }
        }
        const r = await rdRead(p, path, params, bearer);
        return Response.json({ ok: r.ok, status: r.status, message: r.ok ? 'Conexão válida' : `${rdErrorHint(r.status)}: ${JSON.stringify(r.data).slice(0, 160)}` });
      } catch (e) {
        return Response.json({ ok: false, status: 0, message: e.message });
      }
    }

    // step
    let run = b.run_id ? await db.RdSyncRun.get(b.run_id) : null;
    if (run && run.product !== product) return Response.json({ error: 'Execução pertence a outro produto.' }, { status: 409 });
    if (run?.status === 'done') return Response.json({ run, done: true });
    if (run && product === 'crm' && (run.cursor?.pagination_version !== crmPaginationVersion || run.cursor?.completed)) {
      return Response.json({ error: 'Execução de paginação anterior ou finalizada com divergência; inicie uma nova sincronização sem run_id.' }, { status: 409 });
    }
    if (!run) {
      run = await db.RdSyncRun.create({
        product, status: 'running', cursor: initialCursor(product, Math.min(Math.max(Number(b.months) || 12, 1), 36)),
        pages: 0, records: 0, started_at: new Date().toISOString(), performed_by: user.email,
      });
    }
    let cursor = run.cursor;
    let pages = run.pages || 0, records = run.records || 0;
    const started = Date.now();
    const now = new Date().toISOString();
    let integrity = null;
    try {
      while (cursor && Date.now() - started < 45000) {
        const page = await fetchPage(product, cursor, base44);
        if (product === 'crm') {
          await persistCrmRecords(db, page.records, run.id, now);
        } else if (page.records.length) {
          const stamped = page.records.map((r: any) => ({ ...r, synced_at: now, run_id: run.id }));
          for (let i = 0; i < stamped.length; i += 200) {
            await db.RdLead.upsert(stamped.slice(i, i + 200), { key: 'external_key' });
          }
        }
        pages++; records += page.records.length; cursor = page.cursor;
      }
      if (!cursor && product === 'crm') {
        integrity = await verifyCrmRun(db, run.id, records);
        if (!integrity.complete) {
          cursor = { pagination_version: crmPaginationVersion, completed: true, integrity };
          throw new Error('Divergência entre linhas lidas e registros distintos gravados; execução não certificada. Inicie nova sincronização.');
        }
      }
    } catch (e) {
      run = await db.RdSyncRun.update(run.id, { status: 'error', cursor, pages, records, last_error: e.message, finished_at: new Date().toISOString() });
      return Response.json({ run, done: true, error: e.message });
    }
    const done = !cursor;
    run = await db.RdSyncRun.update(run.id, {
      status: done ? 'done' : 'running', cursor: cursor || { completed: true, ...(integrity ? { integrity } : {}) }, pages, records, last_error: '',
      ...(done ? { finished_at: new Date().toISOString() } : {}),
    });
    return Response.json({ run, done });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}