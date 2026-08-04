import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function ChurnTimeline({ monthlyChurn }) {
  const data = (monthlyChurn || []).map(m => ({
    mes: `${String(m.mes).padStart(2, "0")}/${m.ano}`,
    churned: m.churned,
  }));

  if (!data || data.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
        <p className="text-gray-500 text-sm">Sem dados de timeline para este período.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <h3 className="text-white font-semibold text-sm mb-3">Quando os Clientes Pararam de Comprar</h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis dataKey="mes" stroke="#6b7280" fontSize={11} />
          <YAxis stroke="#6b7280" fontSize={11} allowDecimals={false} />
          <Tooltip
            contentStyle={{ background: "#111827", border: "#374151", borderRadius: 8 }}
            labelStyle={{ color: "#e5e7eb" }}
            itemStyle={{ color: "#ef4444" }}
          />
          <Bar dataKey="churned" fill="#ef4444" name="Clientes Perdidos" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}