import { Calendar, RefreshCw } from "lucide-react";

// As duas janelas do churn derivam do período do filtro global:
// análise = período escolhido · referência = janela de mesma duração imediatamente anterior.
export default function ChurnWindowBar({ dates, onApply, loading }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-wrap items-center gap-x-6 gap-y-2">
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-purple-400" />
        <h3 className="text-white font-semibold text-sm">Janelas de churn (filtro global)</h3>
      </div>
      <span className="text-xs text-gray-400">
        Referência (quando compravam): <span className="text-gray-200">{dates.ref_start} → {dates.ref_end}</span>
      </span>
      <span className="text-xs text-gray-400">
        Análise (pararam de comprar?): <span className="text-gray-200">{dates.analysis_start} → {dates.analysis_end}</span>
      </span>
      <button
        onClick={onApply}
        disabled={loading}
        className="ml-auto flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
      >
        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        {loading ? "Analisando..." : "Analisar churn"}
      </button>
    </div>
  );
}