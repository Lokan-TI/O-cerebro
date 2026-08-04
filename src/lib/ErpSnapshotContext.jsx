import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useErpSource } from "./ErpSourceContext";

const ErpSnapshotContext = createContext(null);

export function ErpSnapshotProvider({ children }) {
  const { selectedSource } = useErpSource();
  const [snapshot, setSnapshot] = useState(null);
  const [latestRun, setLatestRun] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const pollRef = useRef(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback((sourceId, runId) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const run = await base44.entities.ErpSyncRun.get(runId);
        setLatestRun(run);
        if (run.status !== "running" && run.status !== "pending") {
          stopPolling();
          setRefreshing(false);
          if (run.status === "success" || run.status === "partial") {
            const snaps = await base44.entities.ErpSnapshot.filter(
              { source_id: sourceId, is_current: true }, "-created_date", 1
            );
            setSnapshot(snaps[0] || null);
          }
        }
      } catch {
        stopPolling();
        setRefreshing(false);
      }
    }, 3000);
  }, [stopPolling]);

  const loadSnapshot = useCallback(async (sourceId) => {
    if (!sourceId) {
      setSnapshot(null);
      setLatestRun(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    stopPolling();
    setRefreshing(false);
    try {
      const [snaps, runs] = await Promise.all([
        base44.entities.ErpSnapshot.filter({ source_id: sourceId, is_current: true }, "-created_date", 1),
        base44.entities.ErpSyncRun.filter({ source_id: sourceId }, "-started_at", 1),
      ]);
      setSnapshot(snaps[0] || null);
      setLatestRun(runs[0] || null);
      if (runs[0] && runs[0].status === "running") {
        setRefreshing(true);
        startPolling(sourceId, runs[0].id);
      }
    } catch {
      setSnapshot(null);
      setLatestRun(null);
    } finally {
      setLoading(false);
    }
  }, [startPolling, stopPolling]);

  const refresh = useCallback(async () => {
    if (!selectedSource || refreshing) return;
    setRefreshing(true);
    const sourceId = selectedSource.id;
    const prevRunId = latestRun?.id || null;

    // Dispara sem aguardar — a função processa sincronamente (~30s) e atualiza o registro
    base44.functions.invoke("refreshErpData", { source_id: sourceId }).catch(() => {});

    // Consulta o registro mais recente cujo id seja diferente do anterior
    let attempts = 0;
    const maxAttempts = 80; // 80 × 2s = 160s
    pollRef.current = setInterval(async () => {
      attempts++;
      try {
        const runs = await base44.entities.ErpSyncRun.filter({ source_id: sourceId }, "-started_at", 5);
        const newRun = (runs || []).find(r => r.id !== prevRunId);
        if (!newRun) {
          if (attempts >= maxAttempts) { stopPolling(); setRefreshing(false); }
          return;
        }
        setLatestRun(newRun);
        if (newRun.status === "running" || newRun.status === "pending") return;
        // Concluído
        stopPolling();
        setRefreshing(false);
        if (newRun.status === "success" || newRun.status === "partial") {
          const snaps = await base44.entities.ErpSnapshot.filter(
            { source_id: sourceId, is_current: true }, "-created_date", 1
          );
          setSnapshot(snaps[0] || null);
        }
      } catch {
        stopPolling();
        setRefreshing(false);
      }
    }, 2000);
  }, [selectedSource, refreshing, latestRun?.id, stopPolling]);

  useEffect(() => {
    loadSnapshot(selectedSource?.id);
    return () => stopPolling();
  }, [selectedSource?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ErpSnapshotContext.Provider value={{ snapshot, latestRun, loading, refreshing, refresh }}>
      {children}
    </ErpSnapshotContext.Provider>
  );
}

export function useErpSnapshot() {
  return useContext(ErpSnapshotContext);
}