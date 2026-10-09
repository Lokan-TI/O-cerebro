import { base44 } from "@/api/base44Client";
import { toExclusiveEnd } from "@/lib/periodContract";

// Cache de promessa por fonte+janela: KPIs e tabela compartilham a MESMA
// consulta ao ERP, sem disparar duas vezes a mesma query pesada.
const cache = new Map();

export function fetchClientesAtivos(sourceId, start, end, snapshotVersion = "", light = false) {
  // A versão publicada faz parte da chave: após um refresh, nenhuma aba pode
  // reutilizar silenciosamente o resultado ao vivo calculado sobre a versão anterior.
  const key = `v3${light ? "L" : ""}|${sourceId || "all"}|${start}|${end}|${snapshotVersion || "no-version"}`;
  if (!cache.has(key)) {
    const p = loadSaved(key)
      .then((saved) => saved || fetchAndSave(key, sourceId, start, end, light))
      .catch((e) => {
        cache.delete(key);
        throw e;
      });
    cache.set(key, p);
  }
  return cache.get(key);
}

// Resultado salvo no Base44: abre sem consultar o ERP enquanto a versão não mudar.
async function loadSaved(key) {
  const page = await base44.entities.ClientesAtivosCache.filter({ cache_key: key }, { sort: "-saved_at", limit: 1 });
  const rec = page.items?.[0];
  if (!rec) return null;
  const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: rec.file_uri });
  const res = await fetch(signed_url);
  return res.ok ? res.json() : null;
}

async function fetchAndSave(key, sourceId, start, end, light) {
  const payload = { start_date: start, end_date: end, end_date_exclusive: toExclusiveEnd(end), light };
  if (sourceId) payload.source_id = sourceId;
  const res = await base44.functions.invoke("listClientesAtivos", payload);
  if (res.data?.success === false) throw new Error(res.data.error);
  const data = res.data;
  const file = new File([JSON.stringify(data)], "clientes_ativos.json", { type: "application/json" });
  const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
  await base44.entities.ClientesAtivosCache.create({ cache_key: key, file_uri, row_count: data.rows?.length || 0, saved_at: new Date().toISOString() });
  return data;
}

export function invalidateClientesAtivos() {
  cache.clear();
}