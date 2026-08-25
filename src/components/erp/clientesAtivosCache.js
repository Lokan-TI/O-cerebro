import { base44 } from "@/api/base44Client";
import { toExclusiveEnd } from "@/lib/periodContract";

// Cache de promessa por fonte+janela: KPIs e tabela compartilham a MESMA
// consulta ao ERP, sem disparar duas vezes a mesma query pesada.
const cache = new Map();

export function fetchClientesAtivos(sourceId, start, end, snapshotVersion = "") {
  // A versão publicada faz parte da chave: após um refresh, nenhuma aba pode
  // reutilizar silenciosamente o resultado ao vivo calculado sobre a versão anterior.
  const key = `${sourceId || "all"}|${start}|${end}|${snapshotVersion || "no-version"}`;
  if (!cache.has(key)) {
    const payload = { start_date: start, end_date: end, end_date_exclusive: toExclusiveEnd(end) };
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