import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from "recharts";
import KPICardsDraggable from "@/components/dashboard/KPICardsDraggable.jsx";

const RED = ["#dc2626","#b91c1c","#991b1b","#7f1d1d","#ef4444","#f87171","#fca5a5","#6b7280","#374151"];

export default function TabOverview({ data }) {
  const total = data.length;

  const byVendedor = useMemo(() => {
    const c = {};
    data.forEach((l) => { if (l.vendedor) c[l.vendedor] = (c[l.vendedor] || 0) + 1; });
    return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name: name.length > 14 ? name.slice(0,13)+"…" : name, value }));
  }, [data]);

  const byCategoria = useMemo(() => {
    const c = {};
    data.forEach((l) => { c[l.categoria] = (c[l.categoria] || 0) + 1; });
    return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  }, [data]);

  const byMes = useMemo(() => {
    const c = {};
    data.forEach((l) => { if (l.mes) c[l.mes] = (c[l.mes] || 0) + 1; });
    return Object.entries(c).sort(([a], [b]) => {
      const [ma, ya] = a.split("/"); const [mb, yb] = b.split("/");
      return new Date(`${ya}-${ma}-01`) - new Date(`${yb}-${mb}-01`);
    }).map(([mes, leads]) => ({ mes, leads }));
  }, [data]);

  const topVendedor = byVendedor[0];
  const topCategoria = byCategoria[0];
  const totalVendedores = new Set(data.map(l => l.vendedor).filter(Boolean)).size;
  const mesComMais = byMes.sort((a, b) => b.leads - a.leads)[0];

  const kpiCards = [
    { label: "Total Leads Perdidos", value: total, sub: "oportunidades não convertidas", accent: "border-red-600" },
    { label: "Vendedores Ativos", value: totalVendedores, sub: "com leads registrados", accent: "border-gray-500" },
    { label: "Top Vendedor", value: topVendedor?.name ?? "-", sub: `${topVendedor?.value ?? 0} leads perdidos`, accent: "border-red-800" },
    { label: "Mês Mais Crítico", value: mesComMais?.mes ?? "-", sub: `${mesComMais?.leads ?? 0} leads perdidos`, accent: "border-red-800" },
  ];

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <KPICardsDraggable cards={kpiCards} />

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900 rounded-lg p-5 border border-gray-800">
          <h2 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Leads por Vendedor</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byVendedor} layout="vertical" margin={{ left: 0, right: 20 }}>
              <XAxis type="number" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: "#d1d5db", fontSize: 11 }} width={110} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 6 }} itemStyle={{ color: "#dc2626" }} />
              <Bar dataKey="value" radius={[0,4,4,0]}>
                {byVendedor.map((_, i) => <Cell key={i} fill={RED[i % RED.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-gray-900 rounded-lg p-5 border border-gray-800">
          <h2 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Leads por Categoria de Produto</h2>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={byCategoria} cx="50%" cy="45%" outerRadius={85} dataKey="value" labelLine={false}>
                {byCategoria.map((_, i) => <Cell key={i} fill={RED[i % RED.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 6 }} />
              <Legend formatter={(v) => <span style={{ color: "#d1d5db", fontSize: 11 }}>{v}</span>} iconSize={10} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Evolução mensal */}
      <div className="bg-gray-900 rounded-lg p-5 border border-gray-800">
        <h2 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Evolução Mensal</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={byMes.sort((a,b) => {
            const [ma,ya]=a.mes.split("/"); const [mb,yb]=b.mes.split("/");
            return new Date(`${ya}-${ma}-01`) - new Date(`${yb}-${mb}-01`);
          })}>
            <XAxis dataKey="mes" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 6 }} itemStyle={{ color: "#dc2626" }} />
            <Bar dataKey="leads" fill="#dc2626" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}