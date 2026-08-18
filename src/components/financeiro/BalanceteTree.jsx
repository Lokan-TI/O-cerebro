import { useState } from "react";
import BalanceteNode from "./BalanceteNode";
import { Layers } from "lucide-react";
import { fmtCur } from "@/lib/erpFormat";

export default function BalanceteTree({ saidas = [], entradas = [] }) {
  const [aba, setAba] = useState("saidas");
  const arvore = aba === "saidas" ? saidas : entradas;
  const total = arvore.reduce((s, n) => s + n.valor, 0);

  return (
    <section className="border border-gray-800 bg-gray-900/50 rounded-xl p-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-400" /> Balancete por natureza financeira
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Os 4 níveis do plano financeiro do Sisloc — clique para abrir até a conta analítica.
          </p>
        </div>
        <div className="flex gap-1">
          {[
            { id: "saidas", label: "Despesas" },
            { id: "entradas", label: "Receitas" },
          ].map((t) => (
            <button
              key={t.id} onClick={() => setAba(t.id)}
              className={`text-xs px-3 py-2 rounded-lg border ${
                aba === t.id ? "border-blue-500 bg-blue-500/10 text-blue-300" : "border-gray-700 text-gray-400"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-12 gap-2 text-xs uppercase tracking-wide text-gray-500 pb-2 border-b border-gray-800">
        <div className="col-span-6">Conta</div>
        <div className="col-span-2 text-right">Títulos</div>
        <div className="col-span-2 text-right">% do total</div>
        <div className="col-span-2 text-right pr-2">Valor</div>
      </div>
      {arvore.map((n) => <BalanceteNode key={n.code} node={n} total={total} />)}
      <div className="grid grid-cols-12 gap-2 pt-3">
        <div className="col-span-10 text-sm font-semibold text-white">Total</div>
        <div className="col-span-2 text-right text-sm font-bold text-white tabular-nums pr-2">{fmtCur(total)}</div>
      </div>
    </section>
  );
}