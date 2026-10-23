import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function PadraoFichasChart({ data }) {
  const map = new Map(data.map((d) => [`${d.ano}-${d.mes}`, Number(d.qtd_fichas) || 0]));
  const now = new Date();
  const serie = Array.from({ length: 36 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 35 + i, 1);
    return { label: `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(2)}`, fichas: map.get(`${d.getFullYear()}-${d.getMonth() + 1}`) || 0 };
  });
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={serie}>
        <XAxis dataKey="label" tick={{ fill: "#9ca3af", fontSize: 10 }} interval={2} />
        <YAxis allowDecimals={false} tick={{ fill: "#9ca3af", fontSize: 10 }} width={28} />
        <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151" }} />
        <Bar dataKey="fichas" fill="#a855f7" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}