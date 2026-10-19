import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";

const E = () => base44.entities.FornecedorCache;

// Junta dado original do ERP com as correções feitas no Cérebro.
const merge = (rec) => ({
  ...rec.erp,
  ...(rec.corrections || {}),
  _id: rec.id,
  _erp: rec.erp || {},
  _corrected: Object.keys(rec.corrections || {}),
});

export default function useSupplierCache(sourceKey) {
  const [rows, setRows] = useState(null);
  const [syncedAt, setSyncedAt] = useState(null);
  const [state, setState] = useState("idle"); // idle | loading | syncing
  const [progress, setProgress] = useState("");
  const [error, setError] = useState(null);

  const loadCache = useCallback(async () => {
    setState("loading");
    setError(null);
    const out = [];
    let cursor;
    try {
      do {
        const page = await E().filter({ source_key: sourceKey }, { limit: 1000, cursor });
        out.push(...page.items);
        cursor = page.has_more ? page.next_cursor : null;
      } while (cursor);
      setRows(out.length ? out.map(merge) : null);
      setSyncedAt(out.reduce((m, r) => (r.synced_at > m ? r.synced_at : m), "") || null);
    } catch (e) {
      setError(e?.message || "Falha ao ler o cache");
    } finally {
      setState("idle");
    }
  }, [sourceKey]);

  useEffect(() => { loadCache(); }, [loadCache]);

  const syncFromErp = async () => {
    setState("syncing");
    setError(null);
    try {
      setProgress("Consultando o Sisloc…");
      const payload = sourceKey !== "all" ? { source_id: sourceKey } : {};
      const res = await base44.functions.invoke("listFornecedores", payload);
      const list = res.data?.suppliers || [];
      const now = new Date().toISOString();
      for (let i = 0; i < list.length; i += 500) {
        setProgress(`Salvando no Cérebro ${Math.min(i + 500, list.length)}/${list.length}…`);
        await E().upsert(
          list.slice(i, i + 500).map((s) => ({ source_key: sourceKey, cd_pessoa: String(s.cd_pessoa), erp: s, synced_at: now })),
          { key: ["source_key", "cd_pessoa"] }
        );
      }
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || "Falha ao carregar fornecedores");
    }
    setProgress("");
    await loadCache();
  };

  const saveCorrections = async (row, corrections) => {
    await E().update(row._id, { corrections });
    setRows((rs) => rs.map((r) => (r._id === row._id ? merge({ id: r._id, erp: r._erp, corrections }) : r)));
  };

  // Grava em lote as correções vindas da fonte pública (somente no Cérebro).
  const saveManyCorrections = async (items) => {
    for (let i = 0; i < items.length; i += 500) {
      await E().bulkUpdate(items.slice(i, i + 500).map(({ row, corrections }) => ({ id: row._id, corrections })));
    }
    const byId = Object.fromEntries(items.map((x) => [x.row._id, x.corrections]));
    setRows((rs) => rs.map((r) => (byId[r._id] ? merge({ id: r._id, erp: r._erp, corrections: byId[r._id] }) : r)));
  };

  return { rows, syncedAt, state, progress, error, syncFromErp, saveCorrections, saveManyCorrections };
}