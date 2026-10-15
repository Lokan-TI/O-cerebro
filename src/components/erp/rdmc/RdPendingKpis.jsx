import { CircleDashed } from "lucide-react";
import { PENDING_KPIS } from "@/lib/rdCommercialKpis";

export default function RdPendingKpis() {
  return (
    <div className="bg-gray-900/40 border border-dashed border-amber-800/60 rounded-xl p-4">
      <h4 className="text-sm font-semibold text-amber-300 mb-1">KPIs pendentes de extração</h4>
      <p className="text-[11px] text-gray-500 mb-3">Sem valor exibido: o dado necessário ainda não está disponível. Serão tratados individualmente.</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {PENDING_KPIS.map(([name, why]) => (
          <div key={name} className="flex gap-2 p-2.5 rounded-lg bg-gray-950/60 border border-gray-800">
            <CircleDashed className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-gray-200 font-medium">{name}</p>
              <p className="text-[11px] text-gray-500">{why}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}