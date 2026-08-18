import { RefreshCw } from "lucide-react";

const REGIMES = [
  { id: "baixa", label: "Baixa (caixa)" },
  { id: "vencimento", label: "Vencimento" },
  { id: "emissao", label: "Emissão" },
  { id: "competencia", label: "Competência" },
];

export default function FinanceiroFiltros({ filtros, onChange, onApply, loading }) {
  const set = (k, v) => onChange({ ...filtros, [k]: v });
  return (
    <div className="border border-gray-800 bg-gray-900/50 rounded-xl p-4 flex flex-wrap items-end gap-4">
      <div>
        <label className="block text-xs text-gray-400 mb-1">De</label>
        <input
          type="date" value={filtros.start} onChange={(e) => set("start", e.target.value)}
          className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Até</label>
        <input
          type="date" value={filtros.end} onChange={(e) => set("end", e.target.value)}
          className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Considerar data de</label>
        <div className="flex gap-1">
          {REGIMES.map((r) => (
            <button
              key={r.id} onClick={() => set("regime", r.id)}
              className={`text-xs px-3 py-2 rounded-lg border ${
                filtros.regime === r.id
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                  : "border-gray-700 text-gray-400 hover:text-gray-200"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <button
        onClick={onApply} disabled={loading}
        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm rounded-lg px-4 py-2"
      >
        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Montar
      </button>
    </div>
  );
}