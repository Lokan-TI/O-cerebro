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
    try {
      const res = await base44.functions.invoke("refreshErpData", { source_id: selectedSource.id });
      const data = res?.data || {};
      if (data.success && data.run_id) {
        setLatestRun(prev => ({ ...prev, status: "running", version: data.version, step_label: "Iniciando..." }));
        startPolling(selectedSource.id, data.run_id);
      } else {
        setRefreshing(false);
        throw new Error(data.error || "Falha ao iniciar atualização.");
      }
    } catch (err) {
      setRefreshing(false);
      throw err;
    }
  }, [selectedSource, refreshing, startPolling]);

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