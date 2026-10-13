export const MATCH_LABEL = {
  pending: ["Pendente", "bg-gray-800 text-gray-400"],
  matched: ["Vinculado", "bg-emerald-500/10 text-emerald-400"],
  manual: ["Vínculo manual", "bg-sky-500/10 text-sky-400"],
  ambiguous: ["Ambíguo", "bg-amber-500/10 text-amber-400"],
  unmatched: ["Sem correspondência", "bg-red-500/10 text-red-400"],
  no_identity: ["Sem identificador", "bg-gray-800 text-gray-500"],
  rejected: ["Revisado: não é cliente", "bg-gray-800 text-gray-400"],
};

export const PRODUCT_LABEL = {
  marketing: "RD Marketing",
  crm_deal: "CRM · Negociação",
  crm_contact: "CRM · Contato",
  conversas: "RD Conversas",
};

// Mesmo critério de filtro usado pelo rdFunnel no servidor.
export function buildRdQuery(f) {
  const q = {};
  if (f.start || f.end) q.source_created_at = { ...(f.start ? { $gte: f.start } : {}), ...(f.end ? { $lt: f.end + "T99" } : {}) };
  if (f.product) q.product = f.product;
  for (const k of ["campaign", "origin", "stage"]) if (f[k]) q[k] = f[k];
  if (f.empresa) q.erp_cd_empresa = String(f.empresa);
  if (f.match) q.match_status = f.match;
  return q;
}

export function identityKey(l) {
  if (l.identity_doc) return `doc:${l.identity_doc}`;
  if (l.identity_email) return `email:${l.identity_email}`;
  if (l.identity_phone) return `tel:${l.identity_phone}`;
  return "";
}