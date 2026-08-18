import { fmtCur, fmtNum } from "@/lib/erpFormat";
import { NATUREZA_LABEL } from "@/lib/planoFinanceiro";
import { Droplets } from "lucide-react";

export default function RalosFinanceiros({ rows = [] }) {
  if (!rows.length) return null;
  const max = rows[0].valor || 1;
  return (
    <section className="border border-gray-800 bg-gray-900/50 rounded-xl p-5">
      <h2 className="text-lg font-bold text-white flex items-center gap-2">
        <Droplets className="w-5 h-5 text-red-400" /> Ralos financeiros — para onde o dinheiro está saindo
      </h2>
      <p className="text-sm text-gray-400 mt-1 mb-4">
        Maiores contas de saída do período, já sem transferências entre contas.
      </p>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={`${r.nr}-${r.ds}`} className="grid grid-cols-12 gap-3 items-center">
            <div className="col-span-12 md:col-span-5 min-w-0">
              <div className="text-sm text-white truncate">{r.ds}</div>
              <div className="text-xs text-gray-500">
                {r.nr || "sem conta"} · {NATUREZA_LABEL[r.natureza]}
                {r.sintetica && <span className="text-amber-400"> · conta sintética</span>}
              </div>
            </div>
            <div className="col-span-8 md:col-span-4">
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-red-500/70 rounded-full" style={{ width: `${(r.valor / max) * 100}%` }} />
              </div>
            </div>
            <div className="col-span-4 md:col-span-3 text-right">
              <div className="text-sm text-white tabular-nums">{fmtCur(r.valor)}</div>
              <div className="text-xs text-gray-500">{r.share.toFixed(1)}% · {fmtNum(r.qtd)} títulos</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}