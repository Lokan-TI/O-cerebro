import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from "recharts";

const RED = ["#dc2626","#b91c1c","#991b1b","#7f1d1d","#ef4444","#f87171","#6b7280","#374151"];

export default function TabPrazo({ data }) {
  const byPrazo = useMemo(() => {
    const c = {};
    data.forEach((l) => { c[l.prazo] = (c[l.prazo] || 0) + 1; });
    return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  }, [data]);

  const byModalidade = useMemo(() => {
    const c = {};
    data.forEach((l) => { c[l.modalidade] = (c[l.modalidade] || 0) + 1; });
    return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  }, [data]);

  const prazoVendedor = useMemo(() => {
    const result = {};
    data.forEach((l) => {
      if (!result[l.vendedor]) result[l.vendedor] = {};
      result[l.vendedor][l.prazo] = (result[l.vendedor][l.prazo] || 0) + 1;
    });
    return Object.entries(result).sort((a, b) => {
      const ta = Object.values(a[1]).reduce((s, v) => s + v, 0);
      const tb = Object.values(b[1]).reduce((s, v) => s + v, 0);
      return tb - ta;
    }).slice(0, 10).map(([vendedor, prazos]) => {
      const row = { vendedor: vendedor.length > 14 ? vendedor.slice(0,13)+"…" : vendedor };
      Object.entries(prazos).forEach(([k, v]) => { row[k] = v; });
      return row;
    });
  }, [data]);

  const prazos = [...new Set(data.map(l => l.prazo))];
  const total = data.length;

  return (
    <div className="space-y-6">
      {/* KPI prazo mais comum */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {byPrazo.slice(0, 4).map((p, i) => (
          <div key={p.name} className={`bg-gray-900 rounded-lg p-4 border ${i === 0 ? "border-red-600" : "border-gray-800"}`}>
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">{p.name}</p>
            <p className="text-3xl font-bold text-white">{p.value}</p>
            <p className="text-gray-500 text-xs mt-1">{((p.value / total) * 100).toFixed(1)}% dos leads</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Prazo */}
        <div className="bg-gray-900 rounded-lg p-5 border border-gray-800">
          <h2 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Leads por Prazo de Pagamento</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byPrazo} layout="vertical" margin={{ left: 0, right: 20 }}>
              <XAxis type="number" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: "#d1d5db", fontSize: 11 }} width={160} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 6 }} itemStyle={{ color: "#dc2626" }} />
              <Bar dataKey="value" radius={[0,4,4,0]}>
                {byPrazo.map((_, i) => <Cell key={i} fill={RED[i % RED.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Modalidade D/E */}
        <div className="bg-gray-900 rounded-lg p-5 border border-gray-800">
          <h2 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Modalidade (D / E / T)</h2>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={byModalidade} cx="50%" cy="45%" outerRadius={90} dataKey="value" labelLine={false}>
                {byModalidade.map((_, i) => <Cell key={i} fill={RED[i % RED.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 6 }} />
              <Legend formatter={(v) => <span style={{ color: "#d1d5db", fontSize: 11 }}>{v}</span>} iconSize={10} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Prazo por vendedor stacked */}
      <div className="bg-gray-900 rounded-lg p-5 border border-gray-800">
        <h2 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Prazo por Vendedor</h2>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={prazoVendedor}>
            <XAxis dataKey="vendedor" tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 6 }} />
            <Legend formatter={(v) => <span style={{ color: "#d1d5db", fontSize: 11 }}>{v}</span>} />
            {prazos.map((p, i) => (
              <Bar key={p} dataKey={p} stackId="a" fill={RED[i % RED.length]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}