import { useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useErpSource } from "@/lib/ErpSourceContext";
import MetricResultCard from "./MetricResultCard";
import { Play, ShieldCheck } from "lucide-react";

const METRIC_IDS = ["MTR-023", "MTR-024"];

// Benchmark técnico antigo por NF (lifecycle v1). Não representa o churn oficial de locação v2.
export default function RetentionCanonicalPanel({ periodStart, periodEnd, periodEndInclusive, legacyRunning = false }) {
  const { selectedSource } = useErpSource();
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.all(
        METRIC_IDS.map(async (metric_id) => {
          const res = await base44.functions.invoke("computeMetric", {
            metric_id,
            source_id: selectedSource?.id,
            period_start: periodStart,
            period_end: periodEnd,
            comparison_mode: "none",
          });
          const data = res?.data || res;
          if (data?.error) throw new Error(data.error);
          return data;
        }),
      );
      setItems(results);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }, [selectedSource?.id, periodStart, periodEnd]);

  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-white font-semibold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-purple-400" />
            Comparativo por NF — modelo anterior (MTR-023 / MTR-024)
          </h3>
          <p className="text-xs text-gray-500 mt-1 max-w-2xl">
            Benchmark 12m vs. 12m ancorado em {periodEndInclusive || periodEnd}, usando somente NF faturada (lifecycle v1).
            Não considera contrato vigente, faturamento recorrente da ficha nem movimentação operacional e, por isso, não deve ser usado como churn oficial da locação.
          </p>
        </div>
        <div className="text-right">
          <button onClick={run} disabled={loading || legacyRunning}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-sm text-white">
            <Play className="w-4 h-4" />
            {loading ? "Calculando..." : "Calcular comparativo NF"}
          </button>
          {legacyRunning && (
            <p className="text-[11px] text-amber-300/80 mt-1.5">Aguardando o motor legado liberar a conexão do ERP.</p>
          )}
        </div>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {items && (
        <div className="space-y-3">
          {items.map((it) => (
            <MetricResultCard
              key={it.metric.metric_id}
              definition={{ ...it.metric, trusted: it.trust?.trusted, blocking_questions: it.trust?.blocking_questions }}
              result={it}
            />
          ))}
        </div>
      )}
    </div>
  );
}