// Agrupa resultados com nome exatamente igual — somente cadastros com CNPJ (14 dígitos).
const isCnpj = (doc) => String(doc || '').replace(/\D/g, '').length === 14;

export function groupResults(rows) {
  const out = [], byKey = new Map();
  for (const r of rows) {
    if (!isCnpj(r.document)) { out.push({ type: 'single', row: r }); continue; }
    const key = `${r.source_id}|${r.name}`;
    let g = byKey.get(key);
    if (!g) { g = { type: 'group', name: r.name, source_id: r.source_id, source_name: r.source_name, rows: [] }; byKey.set(key, g); out.push(g); }
    g.rows.push(r);
  }
  return out.map((g) => (g.type === 'group' && g.rows.length === 1 ? { type: 'single', row: g.rows[0], groupable: true } : g));
}

export const daysSince = (d) => (d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : null);