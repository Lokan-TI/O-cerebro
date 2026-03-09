import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function LeadsByMonth({ data }) {
  const counts = {};
  data.forEach((l) => {
    if (l.mes) counts[l.mes] = (counts[l.mes] || 0) + 1;
  });

  const chartData = Object.entries(counts)
    .sort(([a], [b]) => {
      const [ma, ya] = a.split("/");
      const [mb, yb] = b.split("/");
      return new Date(`${ya}-${ma}-01`) - new Date(`${yb}-${mb}-01`);
    })
    .map(([mes, leads]) => ({ mes, leads }));

  return (
    <div className="bg-gray-900 rounded-lg p-5 border border-gray-800">
      <h2 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Evolução Mensal de Leads Perdidos</h2>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ left: 0, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis dataKey="mes" tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 6 }}
            labelStyle={{ color: "#f9fafb" }}
            itemStyle={{ color: "#dc2626" }}
          />
          <Line type="monotone" dataKey="leads" stroke="#dc2626" strokeWidth={2.5} dot={{ fill: "#dc2626", r: 4 }} activeDot={{ r: 6 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}