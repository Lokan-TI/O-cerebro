import { fmtCur } from "@/lib/erpFormat";

// Barra de realização (equivalente ao "Meta do Mês" da referência)
export default function FinProgressGoal({ title, current = 0, target = 0, note }) {
  const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h3 className="text-white font-semibold text-sm mb-2">{title}</h3>
      <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
        <span>{fmtCur(current)} / {fmtCur(target)}</span>
        <span className="text-white font-semibold">{pct.toFixed(0)}%</span>
      </div>
      <div className="h-4 bg-gray-800 rounded">
        <div className="h-4 rounded bg-cyan-500" style={{ width: `${pct}%` }} />
      </div>
      {note && <p className="text-[11px] text-gray-500 mt-2">{note}</p>}
    </div>
  );
}