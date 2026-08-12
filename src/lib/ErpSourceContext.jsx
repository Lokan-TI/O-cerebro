import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";

const ErpSourceContext = createContext(null);
const STORAGE_KEY = "erp_selected_source_id";
export const ALL_SOURCES_ID = "__all__";
const ALL_SOURCES = { id: ALL_SOURCES_ID, name: "Todas as bases" };

export function ErpSourceProvider({ children }) {
  const [sources, setSources] = useState([]);
  const [selectedSource, setSelectedSource] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshSources = useCallback(async () => {
    try {
      const res = await base44.functions.invoke("listErpSources", {});
      const list = res?.data?.sources || [];
      setSources(list);
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === ALL_SOURCES_ID) {
        setSelectedSource(ALL_SOURCES);
      } else {
        const target =
          list.find((s) => s.id === stored) ||
          list.find((s) => s.credential_reference === "env") ||
          list[0] ||
          null;
        setSelectedSource(target);
        if (target) localStorage.setItem(STORAGE_KEY, target.id);
      }
    } catch {
      setSources([]);
      setSelectedSource(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refreshSources(); }, [refreshSources]);

  const selectSource = useCallback((id) => {
    if (id === ALL_SOURCES_ID) {
      setSelectedSource(ALL_SOURCES);
      localStorage.setItem(STORAGE_KEY, ALL_SOURCES_ID);
      return;
    }
    const s = sources.find((x) => x.id === id);
    if (s) {
      setSelectedSource(s);
      localStorage.setItem(STORAGE_KEY, id);
    }
  }, [sources]);

  return (
    <ErpSourceContext.Provider value={{ sources, selectedSource, selectSource, loading, refreshSources }}>
      {children}
    </ErpSourceContext.Provider>
  );
}

export function useErpSource() {
  return useContext(ErpSourceContext);
}