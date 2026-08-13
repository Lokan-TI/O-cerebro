import { useState } from "react";
import { ChevronDown, ChevronRight, HelpCircle } from "lucide-react";

function formatValue(value, unit) {
  if (value == null) return "—";
  if (unit === "BRL") return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  if (unit === "percent") return `${value.toFixed(1)}%`;
  return value.toLocaleString("pt-BR");
}

export default function MetricResultCard({ definition, result }) {
  const [open, setOpen] = useState(false);
  const cmp = result?.comparison;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl">
      <div className="p-4 flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-[240px]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-gray-500">{definition.metric_id}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-900/40 text-amber-300 border border-amber-800">
              {definition.trusted ? "OFICIAL" : "NÃO OFICIAL"}
            </span>
            <span className="text-xs text-gray-600">v{definition.version}</span>
          </div>
          <p className="text-white font-medium mt-1">{definition.business_name}</p>
          <p className="text-xs text-gray-500 mt-0.5">{definition.formula}</p>
        </div>

        <div className="text-right">
          <p className="text-2xl font-semibold text-white">{formatValue(result?.value, definition.unit)}</p>
          {cmp && (
            <p className={`text-xs mt-1 ${(cmp.delta_pct ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {cmp.delta_pct != null ? `${cmp.delta_pct > 0 ? "+" : ""}${cmp.delta_pct}%` : "—"} vs. {cmp.label}
            </p>
          )}
        </div>
      </div>

      <button onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-1.5 px-4 py-2 border-t border-gray-800 text-xs text-gray-500 hover:text-gray-300">
        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        Ficha da métrica, bloqueios e linhagem
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 text-xs">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-gray-400">
            <p>Grain<span className="block text-gray-200">{definition.grain}</span></p>
            <p>Data de referência<span className="block text-gray-200">{definition.time_dimension}</span></p>
            <p>Dono de negócio<span className="block text-gray-200">{definition.business_owner}</span></p>
            <p>Source of truth<span className="block text-gray-200">{definition.source_of_truth}</span></p>
          </div>

          {(definition.blocking_questions || []).length > 0 && (
            <div className="space-y-1">
              <p className="text-gray-500 uppercase tracking-wide">Bloqueios para TRUSTED</p>
              {definition.blocking_questions.map((q, i) => (
                <p key={i} className="text-amber-200/80 flex items-start gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {q}
                </p>
              ))}
            </div>
          )}

          {result?.lineage?.queries && (
            <div className="space-y-1">
              <p className="text-gray-500 uppercase tracking-wide">Linhagem · SQL executada</p>
              {result.lineage.queries.map((q, i) => (
                <pre key={i} className="bg-gray-950 border border-gray-800 rounded-lg p-2 text-[11px] text-gray-400 whitespace-pre-wrap">{q}</pre>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}