// Agrupa resultados com nome semelhante (variações de unidade/cidade e pontuação) — somente cadastros com CNPJ.
// Mesma regra de base44/shared/customerGroup.ts (nameKey).
const isCnpj = (doc) => String(doc || '').replace(/\D/g, '').length === 14;

export const baseName = (name) => String(name || '').split(/\s+[-–|/(]\s*/)[0].trim();
export const nameKey = (name) => baseName(name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
  .replace(/[^A-Z0-9 ]/g, ' ').replace(/\b(LTDA|S ?A|ME|EPP|EIRELI|CIA)\b/g, ' ').replace(/\s+/g, ' ').trim();

export function groupResults(rows) {
  const out = [], byKey = new Map();
  for (const r of rows) {
    const k = nameKey(r.name);
    if (!isCnpj(r.document) || !k) { out.push({ type: 'single', row: r }); continue; }
    const key = `${r.source_id}|${k}`;
    let g = byKey.get(key);
    if (!g) { g = { type: 'group', name: baseName(r.name), source_id: r.source_id, source_name: r.source_name, rows: [] }; byKey.set(key, g); out.push(g); }
    g.rows.push(r);
  }
  return out.map((g) => (g.type === 'group' && g.rows.length === 1 ? { type: 'single', row: g.rows[0], groupable: true } : g));
}

export const daysSince = (d) => (d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : null);