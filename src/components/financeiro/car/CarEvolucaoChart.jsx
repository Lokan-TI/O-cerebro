import { fmtCur } from "@/lib/erpFormat";
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

const short = (v) => {
  const a = Math.abs(v);
  if (a >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(0)}k`;
  return String(Math.round(v));
};

// Barras: CAR do período (liquidado/a vencer/vencido empilhados) · Linhas: acumulado e inadimplência %.
export default function CarEvolucaoChart({ data, acumuladoLabel = "Acumulado no ano", height = 320 }) {
  if (!data.length) return <div className="text-gray-600 text-center py-10 text-sm">Sem títulos no período.</div>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#222" />
        <XAxis dataKey="label" stroke="#666" fontSize={11} />
        <YAxis yAxisId="v" stroke="#666" fontSize={11} tickFormatter={short} />
        <YAxis yAxisId="p" orientation="right" stroke="#f87171" fontSize={11} tickFormatter={(v) => `${v.toFixed(0)}%`} />
        <Tooltip
          contentStyle={{ backgroundColor: "#111", border: "1px solid #333" }}
          formatter={(v, name) => (String(name).includes("%") ? `${Number(v).toFixed(1)}%` : fmtCur(v))}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar yAxisId="v" stackId="car" dataKey="vl_liquidado" name="Liquidado" fill="#22c55e" />
        <Bar yAxisId="v" stackId="car" dataKey="vl_a_vencer" name="A vencer" fill="#f59e0b" />
        <Bar yAxisId="v" stackId="car" dataKey="vl_vencido" name="Vencido" fill="#ef4444" radius={[4, 4, 0, 0]} />
        <Line yAxisId="v" type="monotone" dataKey="acumulado" name={acumuladoLabel} stroke="#a855f7" strokeWidth={2} dot={false} />
        <Line yAxisId="p" type="monotone" dataKey="inad" name="Inadimplência %" stroke="#f87171" strokeDasharray="4 3" dot={{ r: 2 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}