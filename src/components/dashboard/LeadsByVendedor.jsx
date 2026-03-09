import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const COLORS = ["#dc2626", "#b91c1c", "#991b1b", "#7f1d1d", "#ef4444", "#f87171", "#fca5a5"];

export default function LeadsByVendedor({ data }) {
  const counts = {};
  data.forEach((l) => {
    if (l.vendedor) counts[l.vendedor] = (counts[l.vendedor] || 0) + 1;
  });

  const chartData = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([name, value]) => ({ name: name.length > 14 ? name.slice(0, 14) + "…" : name, value, full: name }));

  return (
    <div className="bg-gray-900 rounded-lg p-5 border border-gray-800">
      <h2 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Leads por Vendedor</h2>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
          <XAxis type="number" tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" tick={{ fill: "#d1d5db", fontSize: 11 }} width={110} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 6 }}
            labelStyle={{ color: "#f9fafb" }}
            itemStyle={{ color: "#dc2626" }}
            formatter={(v, n, p) => [v, p.payload.full]}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}