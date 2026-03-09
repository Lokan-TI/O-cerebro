import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from "recharts";

const RED = ["#dc2626","#b91c1c","#991b1b","#7f1d1d","#ef4444","#f87171","#fca5a5","#6b7280","#374151","#1f2937"];

export default function TabProdutos({ data }) {
  const byCategoria = useMemo(() => {
    const c = {};
    data.forEach((l) => { c[l.categoria] = (c[l.categoria] || 0) + 1; });
    return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  }, [data]);

  const byProdutoExato = useMemo(() => {
    const c = {};
    data.forEach((l) => { if (l.produto) c[l.produto.trim()] = (c[l.produto.trim()] || 0) + 1; });
    return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([name, value]) => ({ name: name.length > 18 ? name.slice(0,17)+"…" : name, full: name, value }));
  }, [data]);

  const canalVendedor = useMemo(() => {
    const result = {};
    data.forEach((l) => {
      if (!result[l.vendedor]) result[l.vendedor] = {};
      result[l.vendedor][l.categoria] = (result[l.vendedor][l.categoria] || 0) + 1;
    });
    return Object.entries(result).sort((a, b) => {
      const totalA = Object.values(a[1]).reduce((s, v) => s + v, 0);
      const totalB = Object.values(b[1]).reduce((s, v) => s + v, 0);
      return totalB - totalA;
    }).slice(0, 10).map(([vendedor, cats]) => {
      const row = { vendedor: vendedor.length > 14 ? vendedor.slice(0,13)+"…" : vendedor };
      Object.entries(cats).forEach(([k, v]) => { row[k] = v; });
      return row;
    });
  }, [data]);

  const categorias = [...new Set(data.map(l => l.categoria))];
  const total = data.length;

  return (
    <div className="space-y-6">
      {/* KPI cards por categoria */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {byCategoria.slice(0, 5).map((c, i) => (
          <div key={c.name} className={`bg-gray-900 rounded-lg p-4 border ${i === 0 ? "border-red-600" : "border-gray-800"}`}>
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-1 truncate">{c.name}</p>
            <p className="text-3xl font-bold text-white">{c.value}</p>
            <p className="text-gray-500 text-xs mt-1">{((c.value / total) * 100).toFixed(1)}% dos leads</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie por categoria */}
        <div className="bg-gray-900 rounded-lg p-5 border border-gray-800">
          <h2 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Distribuição por Categoria</h2>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={byCategoria} cx="50%" cy="45%" outerRadius={90} dataKey="value" labelLine={false}>
                {byCategoria.map((_, i) => <Cell key={i} fill={RED[i % RED.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 6 }} />
              <Legend formatter={(v) => <span style={{ color: "#d1d5db", fontSize: 11 }}>{v}</span>} iconSize={10} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Bar produtos exatos */}
        <div className="bg-gray-900 rounded-lg p-5 border border-gray-800">
          <h2 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Top 15 Produtos Exatos</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={byProdutoExato} layout="vertical" margin={{ left: 0, right: 20 }}>
              <XAxis type="number" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: "#d1d5db", fontSize: 10 }} width={130} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 6 }} formatter={(v, n, p) => [v, p.payload.full]} />
              <Bar dataKey="value" radius={[0,4,4,0]}>
                {byProdutoExato.map((_, i) => <Cell key={i} fill={RED[i % RED.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Canal por vendedor stacked */}
      <div className="bg-gray-900 rounded-lg p-5 border border-gray-800">
        <h2 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Produto / Canal por Vendedor</h2>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={canalVendedor}>
            <XAxis dataKey="vendedor" tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 6 }} />
            <Legend formatter={(v) => <span style={{ color: "#d1d5db", fontSize: 11 }}>{v}</span>} />
            {categorias.map((cat, i) => (
              <Bar key={cat} dataKey={cat} stackId="a" fill={RED[i % RED.length]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}