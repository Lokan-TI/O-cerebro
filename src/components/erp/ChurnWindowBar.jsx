import { Calendar, RefreshCw, ShieldCheck } from "lucide-react";

const OPTIONS = [6, 12, 13, 18, 24];

// Churn = cliente sem nova remessa aprovada durante a janela de inatividade (padrão 13 meses,
// para respeitar clientes de sazonalidade anual) E sem contrato de locação ativo/movimentado.
export default function ChurnWindowBar({ dates, onApply, loading, inactivityMonths, onChangeMonths }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-purple-400" />
          <h3 className="text-white font-semibold text-sm">Janelas de churn</h3>
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-400">
          Inatividade para considerar churn:
          <select
            value={inactivityMonths}
            onChange={(e) => onChangeMonths(Number(e.target.value))}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white"
          >
            {OPTIONS.map((m) => (
              <option key={m} value={m}>{m} meses</option>
            ))}
          </select>
        </label>
        <button
          onClick={onApply}
          disabled={loading}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Analisando..." : "Analisar churn"}
        </button>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1">
        <span className="text-xs text-gray-400">
          Referência (quando alugavam): <span className="text-gray-200">{dates.ref_start} → {dates.ref_end_inclusive}</span>
        </span>
        <span className="text-xs text-gray-400">
          Inatividade (pararam de alugar?): <span className="text-gray-200">{dates.analysis_start} → {dates.analysis_end_inclusive}</span>
        </span>
      </div>

      <p className="text-xs text-gray-500 flex items-start gap-2">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
        Cliente com contrato de locação em aberto (ficha sem encerramento) ou com movimentação na
        ficha dentro da janela nunca é contado como churn, mesmo sem nova remessa.
      </p>
    </div>
  );
}