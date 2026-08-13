import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useErpSource } from "@/lib/ErpSourceContext";
import { GitCompareArrows, Play, AlertTriangle } from "lucide-react";
import MetricReconRow from "./MetricReconRow";

const YEARS = [2026, 2025, 2024, 2023];

export default function TabReconciliacaoMetricas() {
  const { selectedSource } = useErpSource();
  const [year, setYear] = useState(2025);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadStored = async () => {
    const stored = await base44.entities.MetricReconciliation.filter({
      period_start: `${year}-01-01`,
      period_end: `${year + 1}-01-01`,
    });
    setRows(stored || []);
  };

  useEffect(() => { setSummary(null); loadStored(); }, [year]);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("reconcileMetrics", {
        source_id: selectedSource?.id,
        year,
      });
      setSummary(res.data.summary);
      await loadStored();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  const badge = (label, count, cls) => (
    <span className={`px-2 py-0.5 rounded-full border text-xs ${cls}`}>{label}: {count}</span>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <GitCompareArrows className="w-5 h-5 text-purple-400" /> Reconciliação Legado × Canônico
          </h2>
          <p className="text-xs text-gray-500">
            Regra de migração: nenhuma métrica legada é substituída sem execução em paralelo e divergência justificada.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <label className="text-xs text-gray-500">
            Ano
            <select value={year} onChange={(e) => setYear(Number(e.target.value))}
              className="block mt-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <button onClick={run} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-lg text-sm text-white">
            <Play className="w-4 h-4" /> {loading ? "Reconciliando…" : "Executar reconciliação"}
          </button>
        </div>
      </div>

      {summary && (
        <div className="flex flex-wrap gap-2">
          {badge("Aderentes", summary.match, "bg-emerald-950/40 border-emerald-800 text-emerald-300")}
          {badge("Atenção", summary.warn, "bg-amber-950/40 border-amber-800 text-amber-300")}
          {badge("Divergentes", summary.fail, "bg-red-950/40 border-red-900 text-red-300")}
          {badge("Sem legado", summary.no_legacy, "bg-gray-800 border-gray-700 text-gray-400")}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 bg-red-950/40 border border-red-900 rounded-lg p-3 text-sm text-red-300">
          <AlertTriangle className="w-4 h-4 mt-0.5" /> {error}
        </div>
      )}

      <div className="space-y-3">
        {rows.map((r) => <MetricReconRow key={r.metric_id} row={r} onSaved={loadStored} />)}
        {!rows.length && !loading && (
          <p className="text-sm text-gray-500">
            Nenhuma reconciliação apurada para {year}. Execute a reconciliação para comparar o snapshot atual com a camada semântica.
          </p>
        )}
      </div>
    </div>
  );
}