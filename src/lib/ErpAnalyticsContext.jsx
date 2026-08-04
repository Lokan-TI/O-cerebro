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
  const [empresaFilter, setEmpresaFilter] = useState(null); // cd_empresa | null

  const fetchAnalytics = useCallback(async () => {
    if (!selectedSource?.id) return;
    setLoading(true);
    setError(null);
    try {
      const payload = { source_id: selectedSource.id, year };
      if (empresaFilter != null) payload.cd_empresa = empresaFilter;
      const res = await base44.functions.invoke("erpAnalytics", payload);
      const result = res?.data || res;
      if (result?.success === false) {
        setError(result.error || "Erro ao buscar dados");
        setData(null);
      } else {
        setData(result);
      }
    } catch (e) {
      setError(e.message || String(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedSource?.id, year, empresaFilter]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  return (
    <ErpAnalyticsContext.Provider value={{
      data, loading, error, year, setYear,
      empresaFilter, setEmpresaFilter,
      refetch: fetchAnalytics,
    }}>
      {children}
    </ErpAnalyticsContext.Provider>
  );
}

export function useErpAnalytics() {
  return useContext(ErpAnalyticsContext);
}