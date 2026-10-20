import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";

const E = () => base44.entities.FornecedorCache;

import { PUBLIC_MAP } from "./publicFields";

// Prioridade por campo: correção manual > fonte pública > ERP.
const merge = (rec) => {
  const pub = rec.public_status === "ok" ? rec.public_data || {} : {};
  const pubVals = Object.fromEntries(PUBLIC_MAP.map(([k, s]) => [k, String(pub[s] ?? "").trim()]).filter(([, v]) => v));
  return {
    ...rec.erp,
    ...pubVals,
    ...(rec.corrections || {}),
    _id: rec.id,
    _erp: rec.erp || {},
    _pub: pub,
    _pubStatus: rec.public_status || "",
    _pubError: rec.public_error || "",
    _corrections: rec.corrections || {},
    _corrected: Object.keys(rec.corrections || {}),
  };
};
const recOf = (r) => ({ id: r._id, erp: r._erp, corrections: r._corrections, public_data: r._pub, public_status: r._pubStatus, public_error: r._pubError });

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
    setRows((rs) => rs.map((r) => (r._id === row._id ? merge({ ...recOf(r), corrections }) : r)));
  };

  // Grava o retorno da fonte pública por fornecedor (somente no Cérebro, nunca no ERP).
  const savePublic = async (items) => {
    const now = new Date().toISOString();
    const upd = items.map(({ row, res }) => ({
      id: row._id, public_status: res.status, public_error: res.error || "",
      public_data: res.status === "ok" ? res : row._pub || {}, public_at: now,
    }));
    for (let i = 0; i < upd.length; i += 500) await E().bulkUpdate(upd.slice(i, i + 500));
    const byId = Object.fromEntries(upd.map((u) => [u.id, u]));
    setRows((rs) => rs.map((r) => (byId[r._id] ? merge({ ...recOf(r), ...byId[r._id] }) : r)));
  };

  // Grava em lote as correções vindas da fonte pública (somente no Cérebro).
  const saveManyCorrections = async (items) => {
    for (let i = 0; i < items.length; i += 500) {
      await E().bulkUpdate(items.slice(i, i + 500).map(({ row, corrections }) => ({ id: row._id, corrections })));
    }
    const byId = Object.fromEntries(items.map((x) => [x.row._id, x.corrections]));
    setRows((rs) => rs.map((r) => (byId[r._id] ? merge({ ...recOf(r), corrections: byId[r._id] }) : r)));
  };

  return { rows, syncedAt, state, progress, error, syncFromErp, saveCorrections, saveManyCorrections, savePublic };
}