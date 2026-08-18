import { fmtCur, fmtNum } from "@/lib/erpFormat";
import { labelOf } from "@/lib/planoFinanceiro";
import { Users } from "lucide-react";

export default function FornecedoresSaida({ fornecedores = [], idx = {} }) {
  if (!fornecedores.length) return null;
  const total = fornecedores.reduce((s, f) => s + f.valor, 0);
  return (
    <section className="border border-gray-800 bg-gray-900/50 rounded-xl p-5">
      <h2 className="text-lg font-bold text-white flex items-center gap-2">
        <Users className="w-5 h-5 text-amber-400" /> Concentração de pagamentos por fornecedor
      </h2>
      <p className="text-sm text-gray-400 mt-1 mb-4">
        Maiores destinos de pagamento no período — base para renegociação. Transferências entre contas excluídas.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wide text-gray-500">
            <tr className="border-b border-gray-800">
              <th className="text-left py-2">Fornecedor</th>
              <th className="text-left py-2">Natureza</th>
              <th className="text-right py-2">Títulos</th>
              <th className="text-right py-2">Pago</th>
              <th className="text-right py-2">% do top</th>
            </tr>
          </thead>
          <tbody>
            {fornecedores.slice(0, 25).map((f, i) => (
              <tr key={`${f.fornecedor}-${f.n3}-${i}`} className="border-b border-gray-800/60">
                <td className="py-2 text-gray-200">{f.fornecedor}</td>
                <td className="py-2 text-gray-500 text-xs">{labelOf(idx, f.n3)}</td>
                <td className="py-2 text-right text-gray-400 tabular-nums">{fmtNum(f.qtd)}</td>
                <td className="py-2 text-right text-white tabular-nums">{fmtCur(f.valor)}</td>
                <td className="py-2 text-right text-gray-400 tabular-nums">
                  {total ? ((f.valor / total) * 100).toFixed(1) : "0.0"}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}