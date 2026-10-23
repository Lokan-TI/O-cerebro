import { base44 } from "@/api/base44Client";

let listaPromise = null;
const detalheCache = new Map();

export function fetchPadraoLista() {
  if (!listaPromise) {
    listaPromise = base44.functions.invoke("analisePadraoLocacao", {})
      .then((r) => new Map((r.data?.rows || []).map((x) => [String(x.cd_pessoa), x])))
      .catch((e) => { listaPromise = null; throw e; });
  }
  return listaPromise;
}

export function fetchPadraoDetalhe(cd) {
  const k = String(cd);
  if (!detalheCache.has(k)) {
    detalheCache.set(k, base44.functions.invoke("analisePadraoLocacao", { cd_pessoa: cd })
      .then((r) => r.data)
      .catch((e) => { detalheCache.delete(k); throw e; }));
  }
  return detalheCache.get(k);
}

export const fmtData = (d) => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "—");