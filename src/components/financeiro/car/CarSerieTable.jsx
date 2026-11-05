import { fmtCur, fmtNum } from "@/lib/erpFormat";

export default function CarSerieTable({ data }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="overflow-x-auto max-h-96">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 text-xs uppercase">
              <th className="text-left">Período</th>
              <th className="text-right">Títulos</th>
              <th className="text-right">Total</th>
              <th className="text-right">Liquidado</th>
              <th className="text-right">A vencer</th>
              <th className="text-right">Vencido</th>
              <th className="text-right">Inadimpl.</th>
              <th className="text-right">Acumulado</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.label}>
                <td className="text-white">{r.label}</td>
                <td className="text-right text-gray-400">{fmtNum(r.qtd)}</td>
                <td className="text-right text-blue-400 font-medium">{fmtCur(r.vl_total)}</td>
                <td className="text-right text-green-400">{fmtCur(r.vl_liquidado)}</td>
                <td className="text-right text-amber-400">{fmtCur(r.vl_a_vencer)}</td>
                <td className="text-right text-red-400">{fmtCur(r.vl_vencido)}</td>
                <td className="text-right text-red-300">{r.inad.toFixed(1)}%</td>
                <td className="text-right text-purple-300">{fmtCur(r.acumulado)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}