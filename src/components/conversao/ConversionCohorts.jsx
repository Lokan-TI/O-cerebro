import { fmtCur, fmtNum } from "@/lib/erpFormat";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const pctTxt = (v) => (v == null ? "—" : `${v.toFixed(1)}%`);

export default function ConversionCohorts({ cohorts }) {
  const data = (cohorts || []).map((c) => ({
    mes: c.mes,
    Cadastros: c.novos,
    "Com ficha": c.com_ficha,
    "Com NF": c.com_nf,
  }));

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-white font-semibold text-sm mb-4">Conversão por mês de cadastro (coorte)</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="mes" stroke="#6b7280" fontSize={11} />
            <YAxis stroke="#6b7280" fontSize={11} />
            <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Cadastros" fill="#9333ea" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Com ficha" fill="#2563eb" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Com NF" fill="#16a34a" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-white font-semibold text-sm mb-4">Tabela da coorte</h3>
        <div className="overflow-x-auto max-h-[280px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-900">
              <tr className="text-gray-500 text-xs uppercase border-b border-gray-800">
                <th className="text-left py-2 px-2">Mês de cadastro</th>
                <th className="text-right py-2 px-2">Novos</th>
                <th className="text-right py-2 px-2">Ficha</th>
                <th className="text-right py-2 px-2">NF</th>
                <th className="text-right py-2 px-2">Conv. ficha</th>
                <th className="text-right py-2 px-2">Conv. NF</th>
                <th className="text-right py-2 px-2">Faturamento</th>
              </tr>
            </thead>
            <tbody>
              {(cohorts || []).map((c) => (
                <tr key={c.mes} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="py-2 px-2 text-white">
                    {c.mes}
                    {c.em_andamento && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-900/60 text-amber-300">MÊS EM ANDAMENTO</span>}
                  </td>
                  <td className="py-2 px-2 text-right text-gray-200">{fmtNum(c.novos)}</td>
                  <td className="py-2 px-2 text-right text-blue-400">{fmtNum(c.com_ficha)}</td>
                  <td className="py-2 px-2 text-right text-green-400">{fmtNum(c.com_nf)}</td>
                  <td className="py-2 px-2 text-right text-gray-300">{pctTxt(c.taxa_ficha)}</td>
                  <td className="py-2 px-2 text-right text-gray-300">{pctTxt(c.taxa_nf)}</td>
                  <td className="py-2 px-2 text-right text-green-400">{fmtCur(c.faturamento)}</td>
                </tr>
              ))}
              {(!cohorts || cohorts.length === 0) && (
                <tr><td colSpan={7} className="text-center text-gray-600 py-6">Sem coortes no período</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}