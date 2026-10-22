import { fetchDetalhes } from "./useQuedaLocacoes";

// Cache de promessas por cliente: o detalhe aberto reaproveita a carga em lote já feita.
const cache = new Map();
const k = (params, id) => `${JSON.stringify(params)}|${id}`;

function split(d, ids) {
  const out = {};
  ids.forEach((id) => { out[id] = { fichas: [], orcamentos: [] }; });
  d.fichas.forEach((f) => out[f.cd_pessoa]?.fichas.push(f));
  d.orcamentos.forEach((o) => out[o.cd_pessoa]?.orcamentos.push(o));
  return out;
}

export function prefetchDetalhes(params, ids) {
  const pend = ids.map(String).filter((id) => !cache.has(k(params, id)));
  if (!pend.length) return;
  const all = fetchDetalhes(params, pend).then((d) => split(d, pend));
  pend.forEach((id) => {
    const p = all.then((m) => m[id]);
    p.catch(() => cache.delete(k(params, id)));
    cache.set(k(params, id), p);
  });
}

export function getDetalhe(params, id) {
  prefetchDetalhes(params, [id]);
  return cache.get(k(params, String(id)));
}