import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { crmGet } from '../../shared/rdCrmOAuth.ts';

// Extrai os produtos (modelos de plataforma) de um lote de negociações do RD CRM no período.
// Cada chamada processa até 40 negociações ainda não extraídas; devolve quantas faltam.
const BATCH = 40;

async function productCatalog(base44: any) {
  const map: Record<string, string> = {};
  for (let p = 1; p <= 20; p++) {
    const j = await crmGet(base44, 'products', { 'page[number]': String(p), 'page[size]': '100' });
    const data = j?.data || [];
    for (const x of data) map[x.id] = x.name || '';
    if (!j?.links?.next && data.length < 100) break;
  }
  return map;
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') return Response.json({ error: 'Restrito a administradores.' }, { status: 403 });
    const { start, endExclusive } = await req.json();
    const db = base44.asServiceRole.entities;
    const scope = { product: 'crm_deal', source_created_at: { $gte: start, $lt: endExclusive } };
    const pendingQ = { ...scope, products_synced_at: { $exists: false } };

    const page = await db.RdLead.filter(pendingQ, { limit: BATCH, fields: ['external_id', 'deal_status', 'owner', 'source_created_at'] });
    const deals = page.items || [];
    if (deals.length) {
      const names = await productCatalog(base44);
      const now = new Date().toISOString();
      const items: any[] = [];
      const updates: any[] = [];
      for (const d of deals) {
        const j = await crmGet(base44, `deals/${d.external_id}/products`, { 'page[size]': '100' });
        const list = j?.data || [];
        for (const it of list) items.push({
          external_key: `${d.external_id}:${it.id}`, deal_id: d.external_id, product_id: it.product_id,
          product_name: names[it.product_id] || 'Produto sem nome', quantity: Number(it.quantity) || 0,
          total_price: Number(it.total_price) || 0, deal_status: d.deal_status, owner: d.owner, deal_created_at: d.source_created_at,
        });
        updates.push({ id: d.id, products_synced_at: now, products_count: list.length });
      }
      if (items.length) await db.RdDealProduct.upsert(items, { key: 'external_key' });
      await db.RdLead.bulkUpdate(updates);
    }
    const [remaining, total] = await Promise.all([db.RdLead.count(pendingQ), db.RdLead.count(scope)]);
    return Response.json({ processed: deals.length, remaining, total });
  } catch (e) {
    return Response.json({ error: String(e?.message || e) }, { status: 500 });
  }
}