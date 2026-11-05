import { useState, useMemo } from "react";
import { BarChart3 } from "lucide-react";
import { monthlySeries, yearlySeries } from "@/lib/carAnalise";
import CarEvolucaoChart from "@/components/financeiro/car/CarEvolucaoChart";
import CarSerieTable from "@/components/financeiro/car/CarSerieTable";

export default function CarVisaoGeral({ rows }) {
  const [modo, setModo] = useState("mensal");
  const mensal = useMemo(() => monthlySeries(rows), [rows]);
  const anual = useMemo(() => yearlySeries(rows), [rows]);
  const data = modo === "anual" ? anual : mensal;

  return (
    <div className="space-y-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <h3 className="text-white font-semibold text-sm flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-purple-400" />
            CAR {modo === "anual" ? "por ano (acumulado histórico)" : "por mês (acumulado no ano)"}
          </h3>
          <div className="flex gap-1 bg-gray-800 border border-gray-700 rounded-lg p-0.5">
            {[["mensal", "Mensal"], ["anual", "Anual"]].map(([id, label]) => (
              <button key={id} onClick={() => setModo(id)} className={`px-3 py-1 rounded-md text-xs font-medium ${modo === id ? "bg-purple-600 text-white" : "text-gray-400 hover:text-gray-200"}`}>{label}</button>
            ))}
          </div>
        </div>
        <CarEvolucaoChart data={data} acumuladoLabel={modo === "anual" ? "Acumulado histórico" : "Acumulado no ano"} />
      </div>
      <CarSerieTable data={[...data].reverse()} />
    </div>
  );
}