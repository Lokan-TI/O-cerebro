import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Gerência das conexões RD via API: list · save (editar/restaurar) · delete (remove conexão + dados sincronizados).
const PRODUCTS = ['crm', 'marketing', 'conversas'];
const LEAD_PRODUCTS: Record<string, string[]> = { crm: ['crm_deal', 'crm_contact'], marketing: ['marketing'], conversas: ['conversas'] };

async function purge(entity: any, query: any) {
  let total = 0;
  for (let i = 0; i < 400; i++) {
    const n = await entity.count(query);
    if (!n) return total;
    const page = await entity.filter(query, { limit: 500, fields: ['id'] });
    const ids = (page.items || []).map((r: any) => r.id);
    if (!ids.length) return total;
    await entity.deleteMany({ id: { $in: ids } });
    total += ids.length;
  }
  throw new Error('Exclusão incompleta: tente novamente para concluir.');
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Restrito a administradores.' }, { status: 403 });
    const b = await req.json().catch(() => ({}));
    const db = base44.asServiceRole.entities;
    const rows = await db.RdApiConnection.list('-updated_date', 20);
    const find = (p: string) => rows.find((r: any) => r.product === p);

    if (b.action === 'list') {
      return Response.json({
        connections: PRODUCTS.map((p) => {
          const r = find(p) || {};
          return { product: p, label: r.label || '', notes: r.notes || '', removed: !!r.removed, has_token: !!r.token, token_updated_at: r.token_updated_at || null };
        }),
      });
    }

    const product = String(b.product || '');
    if (!PRODUCTS.includes(product)) return Response.json({ error: 'Conexão inválida.' }, { status: 400 });
    const existing = find(product);
    const upsert = (data: any) => existing ? db.RdApiConnection.update(existing.id, data) : db.RdApiConnection.create({ product, ...data });

    if (b.action === 'save') {
      const data: any = { updated_by: user.email };
      if (typeof b.label === 'string') data.label = b.label.trim();
      if (typeof b.notes === 'string') data.notes = b.notes;
      if (b.restore) { data.removed = false; data.removed_at = null; }
      if (b.clear_token) { data.token = ''; data.token_updated_at = null; }
      else if (typeof b.token === 'string' && b.token.trim()) { data.token = b.token.trim(); data.token_updated_at = new Date().toISOString(); }
      await upsert(data);
      return Response.json({ ok: true });
    }

    if (b.action === 'delete') {
      if (!b.confirm) return Response.json({ error: 'Confirmação obrigatória.' }, { status: 400 });
      const leads = await purge(db.RdLead, { product: { $in: LEAD_PRODUCTS[product] } });
      const runs = await purge(db.RdSyncRun, { product: product === 'crm' ? 'crm' : product });
      // Conexão OAuth (tokens guardados) é usada por CRM e Marketing: remove junto.
      let oauth = 0;
      if (product !== 'conversas') oauth = await purge(db.RdStationOAuth, { provider: 'rdstation' });
      await upsert({ removed: true, removed_at: new Date().toISOString(), token: '', token_updated_at: null, updated_by: user.email });
      return Response.json({ ok: true, deleted: { leads, runs, oauth } });
    }

    return Response.json({ error: 'Ação inválida.' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}