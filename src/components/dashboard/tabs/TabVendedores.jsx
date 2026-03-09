import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, RadarChart, PolarGrid, PolarAngleAxis, Radar } from "recharts";

const RED = ["#dc2626","#b91c1c","#991b1b","#7f1d1d","#ef4444","#f87171","#fca5a5","#6b7280","#374151","#1f2937","#4b5563","#9ca3af"];

export default function TabVendedores({ data }) {
  const rankingData = useMemo(() => {
    const c = {};
    data.forEach((l) => { if (l.vendedor) c[l.vendedor] = (c[l.vendedor] || 0) + 1; });
    return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([vendedor, total], i) => ({ vendedor, total, rank: i + 1 }));
  }, [data]);

  const byMesVendedor = useMemo(() => {
    const meses = [...new Set(data.map(l => l.mes).filter(Boolean))].sort((a, b) => {
      const [ma,ya]=a.split("/"); const [mb,yb]=b.split("/");
      return new Date(`${ya}-${ma}-01`) - new Date(`${yb}-${mb}-01`);
    });
    const top5 = rankingData.slice(0, 5).map(r => r.vendedor);
    return meses.map(mes => {
      const row = { mes };
      top5.forEach(v => {
        row[v] = data.filter(l => l.mes === mes && l.vendedor === v).length;
      });
      return row;
    });
  }, [data, rankingData]);

  const top5 = rankingData.slice(0, 5).map(r => r.vendedor);
  const total = data.length;

  return (
    <div className="space-y-6">
      {/* Ranking cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {rankingData.slice(0, 5).map((r, i) => (
          <div key={r.vendedor} className={`bg-gray-900 rounded-lg p-4 border ${i === 0 ? "border-red-600" : "border-gray-800"}`}>
            <div className={`text-xs font-bold mb-2 ${i === 0 ? "text-red-400" : "text-gray-600"}`}>#{r.rank}</div>
            <p className="text-white font-semibold text-sm leading-tight">{r.vendedor}</p>
            <p className="text-3xl font-bold text-white mt-1">{r.total}</p>
            <p className="text-gray-500 text-xs mt-1">{((r.total / total) * 100).toFixed(1)}% do total</p>
          </div>
        ))}
      </div>

      {/* Ranking completo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900 rounded-lg p-5 border border-gray-800">
          <h2 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Ranking Completo</h2>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={rankingData} layout="vertical" margin={{ left: 0, right: 30 }}>
              <XAxis type="number" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="vendedor" tick={{ fill: "#d1d5db", fontSize: 10 }} width={120} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 6 }} itemStyle={{ color: "#dc2626" }} />
              <Bar dataKey="total" radius={[0,4,4,0]}>
                {rankingData.map((_, i) => <Cell key={i} fill={i === 0 ? "#dc2626" : i < 3 ? "#991b1b" : "#374151"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Tabela detalhada */}
        <div className="bg-gray-900 rounded-lg p-5 border border-gray-800">
          <h2 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Detalhamento por Vendedor</h2>
          <div className="overflow-auto max-h-80">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-2 px-3 text-gray-400 font-medium">#</th>
                  <th className="text-left py-2 px-3 text-gray-400 font-medium">Vendedor</th>
                  <th className="text-right py-2 px-3 text-gray-400 font-medium">Leads</th>
                  <th className="text-right py-2 px-3 text-gray-400 font-medium">% Total</th>
                </tr>
              </thead>
              <tbody>
                {rankingData.map((r) => (
                  <tr key={r.vendedor} className="border-b border-gray-800 hover:bg-gray-800">
                    <td className="py-2 px-3 text-gray-600">{r.rank}</td>
                    <td className="py-2 px-3 text-gray-200">{r.vendedor}</td>
                    <td className="py-2 px-3 text-right">
                      <span className="text-white font-semibold">{r.total}</span>
                    </td>
                    <td className="py-2 px-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 bg-gray-800 rounded-full h-1.5">
                          <div className="bg-red-600 h-1.5 rounded-full" style={{ width: `${(r.total / total) * 100}%` }} />
                        </div>
                        <span className="text-gray-400 text-xs w-10 text-right">{((r.total / total) * 100).toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Evolução top 5 vendedores por mês */}
      {byMesVendedor.length > 0 && (
        <div className="bg-gray-900 rounded-lg p-5 border border-gray-800">
          <h2 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Evolução Mensal — Top 5 Vendedores</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byMesVendedor}>
              <XAxis dataKey="mes" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 6 }} />
              {top5.map((v, i) => (
                <Bar key={v} dataKey={v} stackId="a" fill={RED[i % RED.length]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}