import { useMemo } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, Cell } from "recharts";

const COLORS = ["#dc2626","#b91c1c","#991b1b","#ef4444","#f87171","#fca5a5","#6b7280","#374151","#1f2937","#4b5563"];

function sortMes(arr) {
  return arr.sort((a, b) => {
    const [ma, ya] = (a.mes || a.name || "01/2025").split("/");
    const [mb, yb] = (b.mes || b.name || "01/2025").split("/");
    return new Date(`${ya}-${ma}-01`) - new Date(`${yb}-${mb}-01`);
  });
}

export default function TabTemporal({ data }) {
  const byMes = useMemo(() => {
    const c = {};
    data.forEach((l) => { if (l.mes) c[l.mes] = (c[l.mes] || 0) + 1; });
    return sortMes(Object.entries(c).map(([mes, leads]) => ({ mes, leads })));
  }, [data]);

  const byMesCategoria = useMemo(() => {
    const cats = [...new Set(data.map(l => l.categoria))];
    const meses = [...new Set(data.map(l => l.mes).filter(Boolean))];
    const sortedMeses = sortMes(meses.map(m => ({ mes: m }))).map(m => m.mes);
    return sortedMeses.map(mes => {
      const row = { mes };
      cats.forEach(cat => {
        row[cat] = data.filter(l => l.mes === mes && l.categoria === cat).length;
      });
      return row;
    });
  }, [data]);

  const cats = [...new Set(data.map(l => l.categoria))];

  // Média mensal
  const media = byMes.length > 0 ? (byMes.reduce((s, m) => s + m.leads, 0) / byMes.length).toFixed(1) : 0;
  const pico = byMes.reduce((max, m) => m.leads > (max?.leads || 0) ? m : max, null);
  const menorMes = byMes.reduce((min, m) => m.leads < (min?.leads || Infinity) ? m : min, null);

  return (
    <div className="space-y-6">
      {/* KPIs temporais */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-gray-900 border-l-4 border-red-600 rounded-lg p-4">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Meses Analisados</p>
          <p className="text-3xl font-bold text-white">{byMes.length}</p>
        </div>
        <div className="bg-gray-900 border-l-4 border-gray-500 rounded-lg p-4">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Média Mensal</p>
          <p className="text-3xl font-bold text-white">{media}</p>
          <p className="text-gray-500 text-xs mt-1">leads por mês</p>
        </div>
        <div className="bg-gray-900 border-l-4 border-red-800 rounded-lg p-4">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Pico de Perdas</p>
          <p className="text-2xl font-bold text-white">{pico?.mes ?? "-"}</p>
          <p className="text-gray-500 text-xs mt-1">{pico?.leads ?? 0} leads perdidos</p>
        </div>
        <div className="bg-gray-900 border-l-4 border-gray-700 rounded-lg p-4">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Mês Menos Crítico</p>
          <p className="text-2xl font-bold text-white">{menorMes?.mes ?? "-"}</p>
          <p className="text-gray-500 text-xs mt-1">{menorMes?.leads ?? 0} leads perdidos</p>
        </div>
      </div>

      {/* Linha de evolução */}
      <div className="bg-gray-900 rounded-lg p-5 border border-gray-800">
        <h2 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Evolução Mensal de Leads Perdidos</h2>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={byMes}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="mes" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 6 }} itemStyle={{ color: "#dc2626" }} />
            <Line type="monotone" dataKey="leads" stroke="#dc2626" strokeWidth={2.5} dot={{ fill: "#dc2626", r: 4 }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Barras por categoria e mês */}
      <div className="bg-gray-900 rounded-lg p-5 border border-gray-800">
        <h2 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Leads por Categoria — Evolução Mensal</h2>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={byMesCategoria}>
            <XAxis dataKey="mes" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 6 }} />
            <Legend formatter={(v) => <span style={{ color: "#d1d5db", fontSize: 11 }}>{v}</span>} />
            {cats.map((cat, i) => (
              <Bar key={cat} dataKey={cat} stackId="a" fill={COLORS[i % COLORS.length]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}