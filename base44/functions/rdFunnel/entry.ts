import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Funil RD Marketing → RD CRM → negociação ganha → receita ERP.
// Pessoas = agrupamento de registros RD por identidade (e-mail, documento, telefone).
// Receita: soma por pessoa ERP distinta (maior receita pós-lead entre seus registros) → sem dupla contagem.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Restrito a administradores.' }, { status: 403 });
    const b = await req.json().catch(() => ({}));
    const query: Record<string, unknown> = {};
    if (b.start || b.end) query.source_created_at = { ...(b.start ? { $gte: b.start } : {}), ...(b.end ? { $lt: b.end + 'T99' } : {}) };
    if (b.product) query.product = b.product;
    if (b.campaign) query.campaign = b.campaign;
    if (b.origin) query.origin = b.origin;
    if (b.stage) query.stage = b.stage;
    if (b.empresa) query.erp_cd_empresa = String(b.empresa);
    if (b.match) query.match_status = b.match;

    const leads: any[] = [];
    let cursor: string | undefined;
    do {
      const page = await base44.asServiceRole.entities.RdLead.filter(query, {
        limit: 1000, cursor,
        fields: ['product', 'identity_email', 'identity_phone', 'identity_doc', 'deal_status', 'match_status', 'erp_cd_pessoa', 'erp_receita_pos_lead', 'amount'],
      });
      leads.push(...(page.items || []));
      cursor = page.has_more ? page.next_cursor : undefined;
    } while (cursor && leads.length < 100000);

    // union-find por identidade
    const parent = leads.map((_, i) => i);
    const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    const seen = new Map<string, number>();
    leads.forEach((l, i) => {
      for (const k of [l.identity_email && 'e' + l.identity_email, l.identity_doc && 'd' + l.identity_doc, l.identity_phone && 't' + l.identity_phone, l.erp_cd_pessoa && 'p' + l.erp_cd_pessoa]) {
        if (!k) continue;
        if (seen.has(k)) parent[find(i)] = find(seen.get(k)!); else seen.set(k, i);
      }
    });
    const clusters = new Map<number, any>();
    leads.forEach((l, i) => {
      const r = find(i);
      const c = clusters.get(r) || { mkt: false, crm: false, conv: false, won: false, pessoa: '', rev: 0 };
      if (l.product === 'marketing') c.mkt = true;
      if (l.product === 'crm_deal' || l.product === 'crm_contact') c.crm = true;
      if (l.product === 'conversas') c.conv = true;
      if (l.deal_status === 'won') c.won = true;
      if (l.erp_cd_pessoa && (l.match_status === 'matched' || l.match_status === 'manual')) {
        c.pessoa = l.erp_cd_pessoa; c.rev = Math.max(c.rev, Number(l.erp_receita_pos_lead) || 0);
      }
      clusters.set(r, c);
    });
    const all = [...clusters.values()];
    const revenue = (list: any[]) => {
      const per = new Map<string, number>();
      list.forEach((c) => { if (c.pessoa) per.set(c.pessoa, Math.max(per.get(c.pessoa) || 0, c.rev)); });
      return { clientes: [...per.values()].filter((v) => v > 0).length, receita: [...per.values()].reduce((a, v) => a + v, 0) };
    };
    const stagesFor = (base: any[]) => {
      const crm = base.filter((c) => c.crm);
      const won = crm.filter((c) => c.won);
      const erp = base.filter((c) => c.pessoa);
      return { entrada: base.length, crm: crm.length, ganhos: won.length, erp_vinculados: erp.length, ...revenue(base) };
    };
    const byStatus: Record<string, number> = {};
    leads.forEach((l) => { byStatus[l.match_status || 'pending'] = (byStatus[l.match_status || 'pending'] || 0) + 1; });
    const byProduct: Record<string, number> = {};
    leads.forEach((l) => { byProduct[l.product] = (byProduct[l.product] || 0) + 1; });

    return Response.json({
      registros: leads.length,
      pessoas: all.length,
      marketing: stagesFor(all.filter((c) => c.mkt)),
      todos: stagesFor(all),
      conversas: stagesFor(all.filter((c) => c.conv)),
      by_status: byStatus,
      by_product: byProduct,
      criterio: 'Receita = NFs não canceladas (universo fiscal padrão) emitidas a partir do mês de criação do lead, por pessoa ERP distinta. Vínculo por documento > e-mail > telefone; ambíguos não entram até revisão manual.',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}