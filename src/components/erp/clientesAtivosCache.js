import { base44 } from "@/api/base44Client";

// Cache de promessa por fonte+janela: KPIs e tabela compartilham a MESMA
// consulta ao ERP, sem disparar duas vezes a mesma query pesada.
const cache = new Map();

export function fetchClientesAtivos(sourceId, start, end) {
  const key = `${sourceId || "all"}|${start}|${end}`;
  if (!cache.has(key)) {
    const payload = { start_date: start, end_date: end };
    if (sourceId) payload.source_id = sourceId;
    const p = base44.functions
      .invoke("listClientesAtivos", payload)
      .then((res) => {
        if (res.data?.success === false) throw new Error(res.data.error);
        return res.data;
      })
      .catch((e) => {
        cache.delete(key);
        throw e;
      });
    cache.set(key, p);
  }
  return cache.get(key);
}

export function invalidateClientesAtivos() {
  cache.clear();
}