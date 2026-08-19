import { useState, useEffect, useCallback, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useErpSource } from "@/lib/ErpSourceContext";
import { useGlobalFilter } from "@/lib/GlobalFilterContext";
import ChurnWindowBar from "./ChurnWindowBar";
import ChurnSummaryCards from "./ChurnSummaryCards";
import ChurnClientTable from "./ChurnClientTable";
import ChurnTimeline from "./ChurnTimeline";
import ChurnNameGroups from "./ChurnNameGroups";
import RetentionCanonicalPanel from "./RetentionCanonicalPanel";
import { AlertTriangle, UserMinus } from "lucide-react";

// Janela de análise = período do filtro global · janela de referência = mesma duração
// imediatamente anterior, para comparar "quem comprava" com "quem parou de comprar".
function windowsFromPeriod(period) {
  const start = new Date(`${period.start}T00:00:00`);
  const end = new Date(`${period.end}T00:00:00`);
  const days = Math.max(1, Math.round((end - start) / 86400000));
  const refStart = new Date(start.getTime() - days * 86400000);
  return {
    ref_start: refStart.toISOString().slice(0, 10),
    ref_end: period.start,
    analysis_start: period.start,
    analysis_end: period.end,
  };
}

export default function TabChurn() {
  const { selectedSource } = useErpSource();
  const { period } = useGlobalFilter();
  const dates = useMemo(() => windowsFromPeriod(period), [period]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const analyze = useCallback(async () => {
    if (!selectedSource) return;
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("analyzeClientChurn", {
        source_id: selectedSource.id,
        ...dates,
      });
      const result = res?.data || res;
      if (result?.success) {
        setData(result);
      } else {
        setError(result?.error || "Falha na análise.");
      }
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }, [selectedSource, dates]);

  useEffect(() => {
    analyze();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSource?.id, dates.ref_start, dates.analysis_end]);

  return (
    <div className="space-y-4">
      <RetentionCanonicalPanel
        periodStart={dates.analysis_start}
        periodEnd={dates.analysis_end}
        legacyRunning={loading}
      />

      <ChurnWindowBar dates={dates} onApply={analyze} loading={loading} />

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          <div>
            <p className="text-red-300 font-medium text-sm">Erro na análise</p>
            <p className="text-red-400 text-xs mt-1">{error}</p>
          </div>
        </div>
      )}

      {loading && !data ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-4 border-gray-700 border-t-purple-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Analisando churn de clientes...</p>
        </div>
      ) : data ? (
        <>
          <ChurnSummaryCards summary={data.summary} />
          {data.monthly_churn?.length > 0 && <ChurnTimeline monthlyChurn={data.monthly_churn} />}
          <ChurnNameGroups clients={data.churned_clients} />
          <ChurnClientTable clients={data.churned_clients} />
        </>
      ) : !loading && !error ? (
        <div className="text-center py-12 text-gray-500">
          <UserMinus className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Clique em "Analisar Churn" para iniciar.</p>
        </div>
      ) : null}
    </div>
  );
}