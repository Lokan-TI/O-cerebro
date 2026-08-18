import { fmtCur } from "@/lib/erpFormat";
import { PieChart as PieIcon } from "lucide-react";

const CUT_STYLE = {
  alto: "border-red-700/50 bg-red-950/20 text-red-300",
  estrategico: "border-amber-700/50 bg-amber-950/20 text-amber-300",
  estrutural: "border-blue-700/50 bg-blue-950/20 text-blue-300",
  contratual: "border-gray-700 bg-gray-900 text-gray-300",
  indefinido: "border-gray-700 bg-gray-900 text-gray-400",
};

export default function CapexOpexPanel({ cap }) {
  return (
    <div className="border border-gray-800 bg-gray-900/60 rounded-xl p-5">
      <h2 className="text-lg font-bold text-white flex items-center gap-2">
        <PieIcon className="w-5 h-5 text-purple-400" /> CAPEX e OPEX — o que cortar e o que manter
      </h2>
      <p className="text-sm text-gray-400 mt-1">
        Tudo que a empresa pagou nos últimos 12 meses (contas a pagar), classificado pelos blocos do plano financeiro.
        Transferências e movimentações entre contas ficam fora do total, pois não são custo.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
        {cap.cortes.map((c) => (
          <div key={c.corte} className={`rounded-lg border p-3 ${CUT_STYLE[c.corte]}`}>
            <div className="text-xs uppercase tracking-wide">{c.label}</div>
            <div className="text-lg font-bold text-white mt-1">{fmtCur(c.valor)}</div>
            <div className="text-xs opacity-80">{c.share.toFixed(1)}% do total pago</div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto mt-5">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-800">
              <th className="py-2 pr-3">Categoria</th>
              <th className="py-2 pr-3">Natureza</th>
              <th className="py-2 pr-3">Decisão</th>
              <th className="py-2 pr-3 text-right">Pago 12m</th>
              <th className="py-2 pr-3 text-right">% do total</th>
              <th className="py-2">Principais contas</th>
            </tr>
          </thead>
          <tbody>
            {cap.categorias.map((c) => (
              <tr key={c.categoria} className="border-b border-gray-800/60 align-top hover:bg-gray-800/30">
                <td className="py-2 pr-3 text-white">{c.categoria}</td>
                <td className="py-2 pr-3">
                  <span className={c.natureza === "capex" ? "text-purple-300" : "text-gray-300"}>
                    {c.natureza === "capex" ? "CAPEX" : "OPEX"}
                  </span>
                </td>
                <td className="py-2 pr-3 text-gray-300">
                  {{ alto: "Cortar / renegociar", estrategico: "Cortar com critério", estrutural: "Redimensionar", contratual: "Manter", indefinido: "Classificar" }[c.corte]}
                </td>
                <td className="py-2 pr-3 text-right text-white">{fmtCur(c.valor)}</td>
                <td className="py-2 pr-3 text-right text-gray-400">{c.share.toFixed(1)}%</td>
                <td className="py-2 text-xs text-gray-400">
                  {c.contas.slice(0, 4).map((a) => `${a.ds_planfin} (${fmtCur(a.vl_12m)})`).join(" · ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500 mt-3">
        Classificação automática pelo texto da conta do plano financeiro. Contas em “A classificar” precisam de
        definição do financeiro antes de virar meta de corte.
      </p>
    </div>
  );
}