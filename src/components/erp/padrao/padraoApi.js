import { base44 } from "@/api/base44Client";

const listaCache = new Map();
const detalheCache = new Map();
const empBody = (emp) => (emp != null ? { cd_empresa: Number(emp) } : {});

export function fetchPadraoLista(emp = null) {
  const k = String(emp ?? "all");
  if (!listaCache.has(k)) {
    listaCache.set(k, base44.functions.invoke("analisePadraoLocacao", empBody(emp))
      .then((r) => new Map((r.data?.rows || []).map((x) => [String(x.cd_pessoa), x])))
      .catch((e) => { listaCache.delete(k); throw e; }));
  }
  return listaCache.get(k);
}

export function fetchPadraoDetalhe(cd, emp = null) {
  const k = `${cd}:${emp ?? "all"}`;
  if (!detalheCache.has(k)) {
    detalheCache.set(k, base44.functions.invoke("analisePadraoLocacao", { cd_pessoa: cd, ...empBody(emp) })
      .then((r) => r.data)
      .catch((e) => { detalheCache.delete(k); throw e; }));
  }
  return detalheCache.get(k);
}

export const fmtData = (d) => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "—");
export const fmtFicha = (n) => (n == null ? "—" : String(n).padStart(6, "0"));