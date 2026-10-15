import { crmGet } from './rdCrmOAuth.ts';

// Chaves verificadas na resposta real de deals da API CRM v2, inclusive "nicel".
export const CUSTOM_FIELDS = {
  demand: ['demandas-do-lead1', 'Tipo de demanda'],
  sector: ['setor', 'Setor'],
  branch: ['filial', 'Filial informada no RD'],
  urgency: ['nivel-de-urgencia', 'Urgência'],
  awareness: ['nicel-de-consciencia', 'Consciência'],
  rental_term: ['prazo-de-locacao', 'Prazo de locação'],
};
export const CUSTOM_VERSION = 1;
const clean = (v) => String(v).trim().replace(/\s+/g, ' ').toLocaleUpperCase('pt-BR');
export function normalizeCustomFields(fields) {
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) throw new Error('RD não retornou o objeto custom_fields; negociação continua pendente.');
  const out = { custom_fields_version: CUSTOM_VERSION, custom_fields_synced_at: new Date().toISOString() };
  for (const [key, [source]] of Object.entries(CUSTOM_FIELDS)) {
    const present = Object.prototype.hasOwnProperty.call(fields, source);
    const raw = fields[source];
    const values = [...new Set((Array.isArray(raw) ? raw : [raw]).filter((v) => v != null && String(v).trim()).map((v) => {
      if (!['string', 'number', 'boolean'].includes(typeof v)) throw new Error(`Formato inesperado no campo ${source}; extração não confirmada.`);
      return clean(v);
    }))].sort();
    out[`custom_${key}`] = key === 'demand' ? JSON.stringify(values) : values.join(' / ');
    out[`custom_${key}_state`] = !present ? 'absent' : values.length ? 'filled' : 'empty';
  }
  return out;
}
export function customScope(start, endExclusive) {
  if (![start, endExclusive].every((d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(Date.parse(d))) || start >= endExclusive) throw new Error('Período inválido.');
  return { product: 'crm_deal', source_created_at: { $gte: start, $lt: endExclusive } };
}
export async function extractCustomFields(base44, scope) {
  const db = base44.asServiceRole.entities.RdLead;
  const pending = { ...scope, custom_fields_version: { $ne: CUSTOM_VERSION } };
  const { items } = await db.filter(pending, { sort: 'id', limit: 20, fields: ['external_id'] });
  let processed = 0;
  const started = Date.now();
  for (const deal of items) {
    const result = await crmGet(base44, `deals/${encodeURIComponent(deal.external_id)}`);
    if (!result.data || String(result.data.id) !== String(deal.external_id)) throw new Error('Resposta RD não corresponde à negociação solicitada.');
    await db.update(deal.id, normalizeCustomFields(result.data.custom_fields));
    processed++;
    if (Date.now() - started > 18000) break;
  }
  const [remaining, total] = await Promise.all([db.count(pending), db.count(scope)]);
  return { processed, remaining, total, done: total - remaining };
}
export async function customSummary(base44, scope) {
  const db = base44.asServiceRole.entities.RdLead;
  const query = { ...scope, custom_fields_version: CUSTOM_VERSION };
  const [total, extracted] = await Promise.all([db.count(scope), db.count(query)]);
  const metrics = [];
  for (const [key, [source, title]] of Object.entries(CUSTOM_FIELDS)) {
    const field = `custom_${key}`, state = `${field}_state`;
    const result = extracted ? await db.aggregate({ query, groupBy: [field, state], sort: '-count', limit: 1000 }) : { rows: [], truncated: false };
    if (result.truncated) throw new Error(`Distribuição de ${title} excedeu o limite de categorias; reduza o período. Nenhum ranking parcial será exibido.`);
    const counts = new Map();
    let filled = 0, empty = 0, absent = 0;
    for (const row of result.rows) {
      if (row[state] === 'absent') { absent += row.count; continue; }
      if (row[state] !== 'filled') { empty += row.count; continue; }
      filled += row.count;
      const values = key === 'demand' ? JSON.parse(row[field]) : [row[field]];
      for (const value of values) counts.set(value, (counts.get(value) || 0) + row.count);
    }
    metrics.push({ key, title, source, filled, empty, absent, rows: [...counts].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value) });
  }
  return { total, extracted, pending: total - extracted, metrics };
}