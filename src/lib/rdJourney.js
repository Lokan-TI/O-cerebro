import { base44 } from "@/api/base44Client";

const FIELDS = ["product", "name", "email", "company_name", "campaign", "origin", "stage", "pipeline", "deal_status", "amount", "owner", "source_created_at", "closed_at", "identity_email", "identity_phone", "identity_doc", "match_status", "erp_nm_pessoa", "erp_receita_pos_lead"];

export async function loadAll(product, start, end) {
  const query = { product };
  if (start || end) query.source_created_at = { ...(start ? { $gte: start } : {}), ...(end ? { $lte: end + "T23:59:59" } : {}) };
  const out = [];
  let cursor;
  do {
    const page = await base44.entities.RdLead.filter(query, { sort: "-source_created_at", limit: 1000, fields: FIELDS, ...(cursor ? { cursor } : {}) });
    out.push(...page.items);
    cursor = page.has_more ? page.next_cursor : null;
  } while (cursor && out.length < 20000);
  return out;
}

export const idKey = (r) => (r.identity_email ? `e:${r.identity_email}` : r.identity_phone ? `t:${r.identity_phone}` : r.identity_doc ? `d:${r.identity_doc}` : null);

export const LINK_LABEL = {
  confiavel: ["Confiável", "bg-emerald-900/50 text-emerald-300"],
  ambiguo: ["Ambíguo", "bg-amber-900/50 text-amber-300"],
  recusado: ["Recusado", "bg-red-900/50 text-red-300"],
  sem_negociacao: ["Sem negociação", "bg-gray-800 text-gray-400"],
  sem_identidade: ["Sem identidade", "bg-gray-800 text-gray-500"],
};

// Une leads de Marketing (coorte = data de criação do lead) às negociações do CRM pela identidade normalizada.
export function buildModel(leads, deals) {
  const dealsBy = {};
  deals.forEach((d) => { const k = idKey(d); if (k) (dealsBy[k] ||= []).push(d); });
  const campBy = {};
  leads.forEach((l) => { const k = idKey(l); if (k) (campBy[k] ||= new Set()).add(l.campaign || "(sem campanha)"); });

  const journeys = leads.map((l) => {
    const k = idKey(l);
    const ds = k ? dealsBy[k] || [] : [];
    let link = !k ? "sem_identidade" : l.match_status === "rejected" ? "recusado" : !ds.length ? "sem_negociacao" : campBy[k].size > 1 ? "ambiguo" : "confiavel";
    const won = ds.filter((d) => d.deal_status === "won");
    const erpOk = ["matched", "manual"].includes(l.match_status);
    return { lead: l, key: k, deals: ds, link, won, wonAmount: won.reduce((s, d) => s + (d.amount || 0), 0), erp: erpOk ? l.erp_receita_pos_lead || 0 : 0 };
  });

  const camps = {};
  journeys.forEach((j) => {
    const c = (camps[j.lead.campaign || "(sem campanha)"] ||= { campaign: j.lead.campaign || "(sem campanha)", origin: j.lead.origin || "—", leads: 0, deals: 0, won: 0, amount: 0, erp: 0, ambiguous: 0, noId: 0 });
    c.leads++;
    if (j.link === "ambiguo") c.ambiguous++;
    if (j.link === "sem_identidade") c.noId++;
    if (j.link === "confiavel") { c.deals++; if (j.won.length) c.won++; c.amount += j.wonAmount; c.erp += j.erp; }
  });

  const trusted = journeys.filter((j) => j.link === "confiavel");
  const kpis = {
    leads: leads.length,
    withDeal: trusted.length,
    won: trusted.filter((j) => j.won.length).length,
    amount: trusted.reduce((s, j) => s + j.wonAmount, 0),
    erp: trusted.reduce((s, j) => s + j.erp, 0),
    ambiguous: journeys.filter((j) => j.link === "ambiguo").length,
    noId: journeys.filter((j) => j.link === "sem_identidade").length,
    dealsPeriod: deals.length,
  };
  return { journeys, campaigns: Object.values(camps).sort((a, b) => b.leads - a.leads), kpis };
}

export const brl = (v) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
export const dt = (v) => (v ? new Date(v).toLocaleDateString("pt-BR") : "—");