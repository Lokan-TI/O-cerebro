import { fmtCur } from "@/lib/erpFormat";

// Ranking horizontal com barra proporcional (padrão "Top 10" do dashboard de referência)
export default function FinRankBars({ title, subtitle, items = [], color = "bg-emerald-500", empty = "Sem dados" }) {
  const max = Math.max(...items.map((i) => Math.abs(i.value || 0)), 1);
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h3 className="text-white font-semibold text-sm">{title}</h3>
      {subtitle && <p className="text-[11px] text-gray-500 mt-0.5 mb-3">{subtitle}</p>}
      <div className="space-y-2 mt-3">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-40 shrink-0 text-xs text-gray-300 truncate" title={it.label}>{it.label}</div>
            <div className="flex-1 h-5 bg-gray-800/60 rounded">
              <div className={`h-5 rounded ${color}`} style={{ width: `${Math.max((Math.abs(it.value) / max) * 100, 2)}%` }} />
            </div>
            <div className="w-28 text-right text-xs text-gray-200 font-medium">{fmtCur(it.value)}</div>
          </div>
        ))}
        {items.length === 0 && <div className="text-center text-gray-600 text-xs py-6">{empty}</div>}
      </div>
    </div>
  );
}