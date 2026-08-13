import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useErpSource } from "@/lib/ErpSourceContext";
import { Layers, Play, AlertTriangle, ShieldAlert } from "lucide-react";
import MetricResultCard from "./MetricResultCard";

const YEARS = [2026, 2025, 2024, 2023];

export default function TabCamadaSemantica() {
  const { selectedSource } = useErpSource();
  const [metrics, setMetrics] = useState([]);
  const [year, setYear] = useState(2025);
  const [comparison, setComparison] = useState("prior_year");
  const [results, setResults] = useState({});
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      const res = await base44.functions.invoke("computeMetric", { list_only: true });
      setMetrics(res.data.metrics || []);
    })();
  }, []);

  const runAll = async () => {
    setRunning(true);
    setError(null);
    setResults({});
    try {
      for (const m of metrics) {
        const res = await base44.functions.invoke("computeMetric", {
          metric_id: m.metric_id,
          source_id: selectedSource?.id,
          period_start: `${year}-01-01`,
          period_end: `${year + 1}-01-01`,
          comparison_mode: comparison,
        });
        setResults((prev) => ({ ...prev, [m.metric_id]: res.data }));
      }
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-purple-400" /> Camada Semântica · Metric Layer
          </h2>
          <p className="text-xs text-gray-500">
            Phase 4 · registry v0.1. Nenhum dashboard implementa fórmula — todo valor sai de computeMetric com contexto e linhagem.
          </p>
        </div>
        <div className="flex items-end gap-2 flex-wrap">
          <label className="text-xs text-gray-500">
            Ano
            <select value={year} onChange={(e) => setYear(Number(e.target.value))}
              className="block mt-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <label className="text-xs text-gray-500">
            Comparação
            <select value={comparison} onChange={(e) => setComparison(e.target.value)}
              className="block mt-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
              <option value="none">sem comparação</option>
              <option value="prior_year">ano anterior</option>
              <option value="prior_period">período anterior</option>
            </select>
          </label>
          <button onClick={runAll} disabled={running || !metrics.length}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-lg text-sm text-white">
            <Play className="w-4 h-4" /> {running ? "Calculando…" : "Calcular métricas"}
          </button>
        </div>
      </div>

      <div className="flex items-start gap-2 bg-amber-950/30 border border-amber-900/60 rounded-lg p-3 text-sm text-amber-200/90">
        <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
        <span>
          Nenhuma métrica do registry está OFICIAL. Cada resultado exibe as perguntas de negócio que bloqueiam a promoção a TRUSTED
          e a SQL exata que produziu o número.
        </span>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-950/40 border border-red-900 rounded-lg p-3 text-sm text-red-300">
          <AlertTriangle className="w-4 h-4 mt-0.5" /> {error}
        </div>
      )}

      <div className="space-y-3">
        {metrics.map((m) => (
          <MetricResultCard key={m.metric_id} definition={m} result={results[m.metric_id]} />
        ))}
        {!metrics.length && <p className="text-sm text-gray-500">Carregando registry…</p>}
      </div>
    </div>
  );
}