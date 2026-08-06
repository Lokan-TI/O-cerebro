import { fmtNum } from "@/lib/erpFormat";
import { ChevronDown } from "lucide-react";

const COLORS = ["bg-purple-600", "bg-blue-600", "bg-green-600"];

export default function ConversionFunnel({ funnel }) {
  const base = funnel?.[0]?.qtd || 0;
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h3 className="text-white font-semibold text-sm mb-4">Funil de conversão</h3>
      <div className="space-y-1">
        {funnel.map((f, i) => {
          const width = base > 0 ? Math.max(8, (f.qtd / base) * 100) : 0;
          return (
            <div key={f.etapa}>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className={`${COLORS[i]} rounded-lg px-4 py-3 flex items-center justify-between`} style={{ width: `${width}%`, minWidth: "220px" }}>
                    <span className="text-white text-sm font-medium">{f.etapa}</span>
                    <span className="text-white text-lg font-bold">{fmtNum(f.qtd)}</span>
                  </div>
                </div>
                <div className="w-56 text-xs text-gray-400 shrink-0">
                  <div>{f.pct_anterior == null ? "—" : `${f.pct_anterior.toFixed(1)}% da etapa anterior`}</div>
                  <div className="text-gray-600">{f.pct_total == null ? "—" : `${f.pct_total.toFixed(1)}% do total inicial`}</div>
                </div>
              </div>
              {i < funnel.length - 1 && (
                <div className="flex items-center gap-2 pl-4 py-1 text-xs text-red-400">
                  <ChevronDown className="w-3.5 h-3.5" />
                  perda de {fmtNum(funnel[i + 1].perda)} clientes
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}