import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useGlobalFilter } from "@/lib/GlobalFilterContext";

// Provider de analytics das abas operacionais/financeiras. Agora consome o filtro
// global (Fonte + Empresa + Período aplicado) — não mantém mais seletor de ano próprio.
const ErpAnalyticsContext = createContext(null);

export function ErpAnalyticsProvider({ children }) {
  const { sourceId, empresaId, period } = useGlobalFilter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAnalytics = useCallback(async () => {
    if (!sourceId) return;
    setLoading(true);
    setError(null);
    const payload = { source_id: sourceId, start_date: period.start, end_date: period.end };
    if (empresaId != null) payload.cd_empresa = empresaId;
    const isTransient = (e) => {
      const m = String(e?.message || e || "");
      return /504|timeout|timed out|network|failed to fetch/i.test(m);
    };
    let attempt = 0;
    let lastErr = null;
    while (attempt < 2) {
      try {
        const res = await base44.functions.invoke("erpAnalytics", payload);
        const result = res?.data || res;
        if (result?.success === false) {
          setError(result.error || "Erro ao buscar dados");
          setData(null);
        } else {
          setData(result);
        }
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        if (!isTransient(e) || attempt === 1) break;
        await new Promise((r) => setTimeout(r, 2000));
        attempt++;
      }
    }
    if (lastErr) {
      setError(
        /504|timeout/i.test(String(lastErr.message || lastErr))
          ? "O banco de dados demorou a responder (504). Toque em 'Atualizar' para tentar novamente."
          : String(lastErr.message || lastErr)
      );
      setData(null);
    }
    setLoading(false);
  }, [sourceId, period.start, period.end, empresaId]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  return (
    <ErpAnalyticsContext.Provider value={{
      data, loading, error, period, refetch: fetchAnalytics,
    }}>
      {children}
    </ErpAnalyticsContext.Provider>
  );
}

export function useErpAnalytics() {
  return useContext(ErpAnalyticsContext);
}