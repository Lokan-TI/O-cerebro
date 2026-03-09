import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

const COLORS = ["#dc2626", "#b91c1c", "#7f1d1d", "#ef4444", "#f87171", "#fca5a5", "#6b7280", "#374151", "#1f2937", "#4b5563"];

export default function LeadsByProduto({ data }) {
  const counts = {};
  data.forEach((l) => {
    if (l.produto) {
      const key = l.produto.trim();
      counts[key] = (counts[key] || 0) + 1;
    }
  });

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 8);
  const outros = sorted.slice(8).reduce((s, [, v]) => s + v, 0);
  if (outros > 0) top.push(["Outros", outros]);

  const chartData = top.map(([name, value]) => ({ name, value }));

  return (
    <div className="bg-gray-900 rounded-lg p-5 border border-gray-800">
      <h2 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Leads por Produto</h2>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie data={chartData} cx="50%" cy="45%" outerRadius={90} dataKey="value" labelLine={false}>
            {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip
            contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 6 }}
            itemStyle={{ color: "#f9fafb" }}
          />
          <Legend
            formatter={(value) => <span style={{ color: "#d1d5db", fontSize: 11 }}>{value}</span>}
            iconSize={10}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}