import { useGlobalFilter, PERIOD_PRESETS } from "@/lib/GlobalFilterContext";
import { CalendarRange, Check } from "lucide-react";

// Controle de Período do filtro global — draft + botão "Aplicar filtros" no GlobalFilterBar.
export default function PeriodFilter() {
  const { periodPreset, setPeriodPreset, customStart, setCustomStart, customEnd, setCustomEnd, period } = useGlobalFilter();
  const isCustom = periodPreset === "personalizado";

  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-gray-500 text-xs uppercase tracking-wider">Período</label>
      <div className="flex items-center gap-2">
        <div className="relative">
          <CalendarRange className="w-4 h-4 text-purple-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <select
            value={periodPreset}
            onChange={(e) => setPeriodPreset(e.target.value)}
            className="appearance-none pl-8 pr-8 py-2 bg-gray-900 hover:bg-gray-800 border border-gray-700 hover:border-purple-500 rounded-lg text-sm text-white font-medium focus:outline-none focus:border-purple-500 min-w-[180px] cursor-pointer transition-colors"
          >
            {PERIOD_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
          <Check className="w-3.5 h-3.5 text-purple-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
        {isCustom && (
          <div className="flex items-center gap-1">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="bg-gray-900 border border-gray-700 rounded-lg text-sm text-white px-2 py-2 focus:outline-none focus:border-purple-500"
            />
            <span className="text-gray-500 text-xs">até</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="bg-gray-900 border border-gray-700 rounded-lg text-sm text-white px-2 py-2 focus:outline-none focus:border-purple-500"
            />
          </div>
        )}
      </div>
      <p className="text-gray-600 text-xs">De {period.start} até {period.end}</p>
    </div>
  );
}