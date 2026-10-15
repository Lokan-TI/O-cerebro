export default function RdRankBars({ title, rows, format = (v) => v.toLocaleString("pt-BR"), max = 10, note }) {
  const top = rows.slice(0, max);
  const peak = Math.max(1, ...top.map((r) => r.value));
  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
      <h4 className="text-sm font-semibold text-gray-200 mb-3">{title}</h4>
      {top.length === 0 ? <p className="text-xs text-gray-500">Sem dados no período.</p> : (
        <div className="space-y-2">
          {top.map((r) => (
            <div key={r.label}>
              <div className="flex justify-between text-xs mb-0.5">
                <span className="text-gray-300 truncate pr-2">{r.label}</span>
                <span className="text-gray-400 tabular-nums">{format(r.value)}</span>
              </div>
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-purple-500 rounded-full transition-all duration-500" style={{ width: `${(r.value / peak) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
      {note && <p className="text-[10px] text-gray-500 mt-3">{note}</p>}
    </div>
  );
}