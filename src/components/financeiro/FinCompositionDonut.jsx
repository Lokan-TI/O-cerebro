import { fmtCur } from "@/lib/erpFormat";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";

const COLORS = ["#22c55e", "#0ea5e9", "#f59e0b", "#a855f7", "#ef4444", "#64748b"];

// Composição das saídas (top contas + "Outras"), no estilo do donut da referência
export default function FinCompositionDonut({ title = "Composição das saídas", items = [] }) {
  const total = items.reduce((s, i) => s + (i.value || 0), 0);
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h3 className="text-white font-semibold text-sm mb-2">{title}</h3>
      {items.length === 0 ? (
        <div className="text-center text-gray-600 text-xs py-10">Sem dados</div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={items} dataKey="value" nameKey="label" innerRadius={55} outerRadius={90} paddingAngle={2}>
                {items.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: "#111", border: "1px solid #333" }} formatter={(v) => fmtCur(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="text-center text-xs text-gray-500">Total {fmtCur(total)}</div>
        </>
      )}
    </div>
  );
}