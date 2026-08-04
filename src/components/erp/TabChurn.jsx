import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useErpSource } from "@/lib/ErpSourceContext";
import ChurnDateRangeFilter from "./ChurnDateRangeFilter";
import ChurnSummaryCards from "./ChurnSummaryCards";
import ChurnClientTable from "./ChurnClientTable";
import ChurnTimeline from "./ChurnTimeline";
import { AlertTriangle, UserMinus } from "lucide-react";

function getDefaultDates() {
  const year = new Date().getFullYear();
  return {
    ref_start: `${year - 1}-01-01`,
    ref_end: `${year}-01-01`,
    analysis_start: `${year}-01-01`,
    analysis_end: new Date().toISOString().slice(0, 10),
  };
}

export default function TabChurn() {
  const { selectedSource } = useErpSource();
  const [dates, setDates] = useState(getDefaultDates);
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
  }, [selectedSource?.id]);

  return (
    <div className="space-y-4">
      <ChurnDateRangeFilter
        dates={dates}
        onChange={setDates}
        onApply={analyze}
        loading={loading}
      />

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