import { fmtCur } from "@/lib/erpFormat";

export default function FinKpiStrip({ items = [] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-px bg-gray-800 border border-gray-800 rounded-xl overflow-hidden">
      {items.map((it, i) => (
        <div key={i} className="bg-gray-900 px-4 py-3">
          <div className="text-lg font-bold text-white leading-tight">
            {it.raw ? it.value : fmtCur(it.value)}
          </div>
          <div className="text-[11px] text-gray-400 mt-0.5">{it.label}</div>
          {it.delta != null && (
            <div className={`text-[11px] mt-1 ${it.delta >= 0 ? "text-green-400" : "text-red-400"}`}>
              {it.delta >= 0 ? "▲" : "▼"} {Math.abs(it.delta).toFixed(1)}% {it.deltaLabel || "vs ano anterior"}
            </div>
          )}
          {it.sub && <div className="text-[11px] text-gray-600 mt-1">{it.sub}</div>}
        </div>
      ))}
    </div>
  );
}