import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useErpSource } from "@/lib/ErpSourceContext";

const ErpAnalyticsContext = createContext(null);

export function ErpAnalyticsProvider({ children }) {
  const { selectedSource } = useErpSource();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear());

  const fetchAnalytics = useCallback(async () => {
    if (!selectedSource?.id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("erpAnalytics", {
        source_id: selectedSource.id,
        year,
      });
      const payload = res?.data || res;
      if (payload?.success === false) {
        setError(payload.error || "Erro ao buscar dados");
        setData(null);
      } else {
        setData(payload);
      }
    } catch (e) {
      setError(e.message || String(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedSource?.id, year]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  return (
    <ErpAnalyticsContext.Provider value={{ data, loading, error, year, setYear, refetch: fetchAnalytics }}>
      {children}
    </ErpAnalyticsContext.Provider>
  );
}

export function useErpAnalytics() {
  return useContext(ErpAnalyticsContext);
}