import { fmtCur } from "@/lib/erpFormat";

export default function ProjectionTable({ rows }) {
  if (!rows.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h3 className="text-white font-semibold text-sm mb-4">Plano ano a ano — cenário base</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 text-xs uppercase border-b border-gray-800">
              <th className="text-left py-2 px-3">Ano</th>
              <th className="text-right py-2 px-3">Conservador</th>
              <th className="text-right py-2 px-3">Base</th>
              <th className="text-right py-2 px-3">Otimista</th>
              <th className="text-right py-2 px-3">Crescimento base</th>
              <th className="text-right py-2 px-3">Frota necessária</th>
              <th className="text-right py-2 px-3">CAPEX necessário</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.ano} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="py-2 px-3 text-white font-medium">{r.ano}</td>
                <td className="py-2 px-3 text-right text-amber-400">{fmtCur(r.conservador)}</td>
                <td className="py-2 px-3 text-right text-purple-300">{fmtCur(r.base)}</td>
                <td className="py-2 px-3 text-right text-green-400">{fmtCur(r.otimista)}</td>
                <td className="py-2 px-3 text-right text-gray-400">{r.crescimento_base.toFixed(1)}%</td>
                <td className="py-2 px-3 text-right text-gray-300">{fmtCur(r.frota_necessaria)}</td>
                <td className="py-2 px-3 text-right text-blue-400">{fmtCur(r.capex_necessario)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}