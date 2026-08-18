import { RotateCcw } from "lucide-react";

const FIELDS = [
  { key: "horizonte", label: "Horizonte (anos)", step: 1, min: 3, max: 20, suffix: "anos" },
  { key: "crescimento_conservador", label: "Crescimento cenário conservador", step: 0.5, suffix: "%" },
  { key: "crescimento_base", label: "Crescimento cenário base", step: 0.5, suffix: "%" },
  { key: "crescimento_otimista", label: "Crescimento cenário otimista", step: 0.5, suffix: "%" },
  { key: "crescimento_terminal", label: "Crescimento terminal (maturidade)", step: 0.5, suffix: "%" },
  { key: "yield_frota", label: "Yield da frota", step: 0.5, suffix: "%" },
  { key: "reinvestimento", label: "Reinvestimento sobre receita", step: 0.5, suffix: "%" },
  { key: "baixa_frota", label: "Baixa/venda anual da frota", step: 0.5, suffix: "%" },
];

export default function ProjectionAssumptions({ assumptions, onChange, onReset }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold text-sm">Premissas do modelo</h3>
          <p className="text-xs text-gray-500 mt-1">
            Iniciam calibradas pelo próprio histórico do ERP. Ajuste para simular outros futuros.
          </p>
        </div>
        <button
          onClick={onReset}
          className="text-xs text-gray-400 hover:text-white flex items-center gap-1 border border-gray-700 rounded-lg px-3 py-1.5"
        >
          <RotateCcw className="w-3 h-3" /> Recalibrar pelo histórico
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {FIELDS.map((f) => (
          <label key={f.key} className="text-xs text-gray-400 space-y-1 block">
            <span>{f.label}</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step={f.step}
                min={f.min ?? 0}
                max={f.max ?? 100}
                value={assumptions[f.key]}
                onChange={(e) => onChange({ ...assumptions, [f.key]: Number(e.target.value) })}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white"
              />
              <span className="text-gray-500">{f.suffix}</span>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}