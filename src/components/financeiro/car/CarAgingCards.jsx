import { fmtCur, fmtNum } from "@/lib/erpFormat";
import { AGING } from "@/lib/carRecuperacao";

// Saldo vencido em aberto por faixa de atraso (aging).
export default function CarAgingCards({ t }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
        <h3 className="text-white font-semibold text-sm">Vencidos em aberto por atraso</h3>
        <span className="text-xs text-gray-400">{fmtNum(t.qtd_aberto)} títulos · <span className="text-red-400 font-semibold">{fmtCur(t.aberto)}</span></span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {AGING.map(([k, label]) => {
          const pct = t.aberto > 0 ? (t[k] / t.aberto) * 100 : 0;
          return (
            <div key={k} className="bg-gray-800/60 rounded-lg p-3">
              <div className="text-xs text-gray-500">{label}</div>
              <div className="text-white font-semibold text-sm mt-1">{fmtCur(t[k])}</div>
              <div className="h-1.5 bg-gray-700 rounded mt-2"><div className="h-1.5 bg-red-500 rounded" style={{ width: `${pct}%` }} /></div>
              <div className="text-[11px] text-gray-500 mt-1">{pct.toFixed(1)}%</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}