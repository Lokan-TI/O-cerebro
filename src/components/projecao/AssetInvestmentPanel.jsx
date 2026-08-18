import { fmtCur, fmtNum } from "@/lib/erpFormat";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from "recharts";

export default function AssetInvestmentPanel({ kpis, fleet }) {
  if (!kpis) return null;
  const data = kpis.history.map((h) => ({
    ano: h.ano,
    capex: h.capex_ref,
    receita: h.receita_ref,
    ativos: h.ativos_comprados,
    intensidade: h.receita_ref > 0 ? (h.capex_ref / h.receita_ref) * 100 : 0,
  }));
  const grupos = fleet?.por_grupo || [];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 xl:col-span-2">
        <h3 className="text-white font-semibold text-sm mb-1">Compras de ativos x receita</h3>
        <p className="text-xs text-gray-500 mb-4">
          Cada real investido em frota gerou, em média, {kpis.receita_por_capex == null ? "—" : `${kpis.receita_por_capex.toFixed(2)}`} de receita
          adicional no ano seguinte. Receita por ativo ativo: {fmtCur(kpis.receita_por_ativo)}.
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#222" />
            <XAxis dataKey="ano" stroke="#666" fontSize={11} />
            <YAxis yAxisId="l" stroke="#666" fontSize={11} tickFormatter={(v) => `${Math.round(v / 1e6)}M`} />
            <YAxis yAxisId="r" orientation="right" stroke="#666" fontSize={11} tickFormatter={(v) => `${Math.round(v)}%`} />
            <Tooltip
              contentStyle={{ backgroundColor: "#111", border: "1px solid #333" }}
              formatter={(v, n) => (n === "Intensidade de CAPEX" ? `${Number(v).toFixed(1)}%` : fmtCur(v))}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar yAxisId="l" dataKey="capex" name="CAPEX" fill="#6366f1" radius={[3, 3, 0, 0]} />
            <Bar yAxisId="l" dataKey="receita" name="Receita" fill="#a855f7" radius={[3, 3, 0, 0]} />
            <Line yAxisId="r" dataKey="intensidade" name="Intensidade de CAPEX" stroke="#f59e0b" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-white font-semibold text-sm mb-4">Capital imobilizado por grupo</h3>
        <div className="overflow-y-auto max-h-[300px]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-900">
              <tr className="text-gray-500 text-xs uppercase border-b border-gray-800">
                <th className="text-left py-2">Grupo</th>
                <th className="text-right py-2">Ativos</th>
                <th className="text-right py-2">Valor</th>
                <th className="text-right py-2">Idade</th>
              </tr>
            </thead>
            <tbody>
              {grupos.map((g, i) => (
                <tr key={i} className="border-b border-gray-800/50">
                  <td className="py-1.5 text-gray-300 truncate max-w-[140px]">{g.grupo}</td>
                  <td className="py-1.5 text-right text-gray-400">{fmtNum(g.ativos)}</td>
                  <td className="py-1.5 text-right text-green-400">{fmtCur(g.valor)}</td>
                  <td className={`py-1.5 text-right ${g.idade_media > 8 ? "text-red-400" : "text-gray-400"}`}>
                    {g.idade_media == null ? "—" : `${g.idade_media.toFixed(1)}a`}
                  </td>
                </tr>
              ))}
              {grupos.length === 0 && (
                <tr><td colSpan={4} className="text-center text-gray-600 py-6">Sem dados de frota</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}