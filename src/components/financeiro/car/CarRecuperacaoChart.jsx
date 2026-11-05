import { useMemo } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { recoveryCurve } from "@/lib/carRecuperacao";

const COLORS = ["#a855f7", "#38bdf8", "#22c55e", "#f59e0b", "#f472b6", "#94a3b8"];

// % acumulado do valor devido que foi recebido até X dias após o vencimento, por ano de vencimento.
export default function CarRecuperacaoChart({ curvas }) {
  const { data, lines } = useMemo(() => recoveryCurve(curvas), [curvas]);
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h3 className="text-white font-semibold text-sm">Curva de recuperação</h3>
      <p className="text-xs text-gray-500 mb-4">% do valor vencido recebido até cada prazo após o vencimento · anos recentes ainda não completaram os prazos longos.</p>
      {!curvas.length ? <div className="text-gray-600 text-center py-10 text-sm">Sem títulos vencidos no período.</div> : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#222" />
            <XAxis dataKey="label" stroke="#666" fontSize={11} />
            <YAxis stroke="#666" fontSize={11} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
            <Tooltip contentStyle={{ backgroundColor: "#111", border: "1px solid #333" }} formatter={(v) => (v == null ? "—" : `${Number(v).toFixed(1)}%`)} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {lines.map((n, i) => (
              <Line key={n} type="monotone" dataKey={n} name={n} stroke={COLORS[i % COLORS.length]} strokeWidth={n === "Total" ? 3 : 1.5} dot={{ r: 2 }} connectNulls />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}