import { fmtCur, fmtNum } from "@/lib/erpFormat";
import { getEmpresaLabel } from "@/lib/empresaLabels";

const inadColor = (p) => (p >= 10 ? "text-red-400" : p >= 5 ? "text-amber-400" : "text-green-400");

export default function CarEmpresaTable({ empresas, selected, onSelect }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h3 className="text-white font-semibold mb-1 text-sm">CAR por empresa</h3>
      <p className="text-xs text-gray-500 mb-4">Clique em uma empresa para ver a evolução dela.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 text-xs uppercase">
              <th className="text-left">Empresa</th>
              <th className="text-right">Títulos</th>
              <th className="text-right">Total</th>
              <th className="text-right">Liquidado</th>
              <th className="text-right">A vencer</th>
              <th className="text-right">Vencido</th>
              <th className="text-right">Inadimplência</th>
            </tr>
          </thead>
          <tbody>
            {empresas.map((r) => (
              <tr key={String(r.cd_empresa)} onClick={() => onSelect(r.cd_empresa)} className={`cursor-pointer ${r.cd_empresa === selected ? "bg-purple-950/50" : ""}`}>
                <td className="text-white">{r.cd_empresa == null ? "Sem empresa" : getEmpresaLabel(r.cd_empresa)}</td>
                <td className="text-right text-gray-400">{fmtNum(r.qtd)}</td>
                <td className="text-right text-blue-400 font-medium">{fmtCur(r.vl_total)}</td>
                <td className="text-right text-green-400">{fmtCur(r.vl_liquidado)}</td>
                <td className="text-right text-amber-400">{fmtCur(r.vl_a_vencer)}</td>
                <td className="text-right text-red-400">{fmtCur(r.vl_vencido)}</td>
                <td className={`text-right font-semibold ${inadColor(r.inad)}`}>{r.inad.toFixed(1)}%</td>
              </tr>
            ))}
            {empresas.length === 0 && <tr><td colSpan={7} className="text-center text-gray-600 py-6">Sem dados de CAR</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}