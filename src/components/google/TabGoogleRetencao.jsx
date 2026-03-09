import { RESUMO, RETIDO_POR_MES, DISTRIB_RECOMPRA } from "@/components/dashboard/googleData.js";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, CartesianGrid, Legend,
} from "recharts";

const fmtR = (v) => "R$ " + (v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const COLORS = ["#3b82f6", "#6b7280", "#a855f7", "#f59e0b", "#22c55e", "#ef4444"];

export default function TabGoogleRetencao() {
  const distribData = DISTRIB_RECOMPRA.map(d => ({
    name: d.fechados_pos === 0 ? "0 recompras" : `${d.fechados_pos} recompra${d.fechados_pos > 1 ? "s" : ""}`,
    clientes: d.clientes,
    pct: (d.pct * 100).toFixed(1),
  }));

  return (
    <div className="space-y-6">
      {/* KPIs retenção */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-900 border-l-4 border-yellow-500 rounded-lg p-5">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">$$ Retido Total</p>
          <p className="text-2xl font-bold text-white">{fmtR(RESUMO.retido_pos_primeiro)}</p>
          <p className="text-gray-500 text-xs mt-1">receita após 1º fechamento</p>
        </div>
        <div className="bg-gray-900 border-l-4 border-purple-500 rounded-lg p-5">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Share de Retenção</p>
          <p className="text-3xl font-bold text-white">{(RESUMO.share_retido * 100).toFixed(1)}%</p>
          <p className="text-gray-500 text-xs mt-1">da receita fechado total</p>
        </div>
        <div className="bg-gray-900 border-l-4 border-blue-500 rounded-lg p-5">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Negócios de Recompra</p>
          <p className="text-3xl font-bold text-white">{RESUMO.total_recompras}</p>
          <p className="text-gray-500 text-xs mt-1">de {RESUMO.total_negocios_fechado} negócios totais</p>
        </div>
        <div className="bg-gray-900 border-l-4 border-green-500 rounded-lg p-5">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Clientes com Recompra</p>
          <p className="text-3xl font-bold text-white">{RESUMO.clientes_recompra}</p>
          <p className="text-gray-500 text-xs mt-1">{(RESUMO.taxa_recompra_entre_won * 100).toFixed(1)}% dos WON</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribuição de recompras */}
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <h2 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Distribuição de Recompras entre Clientes WON</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={distribData}>
              <XAxis dataKey="name" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 6 }}
                formatter={(v, n, p) => [`${v} clientes (${p.payload.pct}%)`]}
              />
              <Bar dataKey="clientes" radius={[4, 4, 0, 0]}>
                {distribData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-gray-600 text-xs mt-3 text-center">79.4% dos WON não fizeram recompra. 20.6% sim.</p>
        </div>

        {/* Receita retida por mês */}
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <h2 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Receita Retida por Mês</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={RETIDO_POR_MES}>
              <XAxis dataKey="mes" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 6 }}
                formatter={(v) => [fmtR(v)]}
              />
              <Bar dataKey="receita_retida" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Receita Retida" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Acumulado */}
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
        <h2 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Receita Retida Acumulada ao Longo do Tempo</h2>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={RETIDO_POR_MES}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="mes" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
            <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 6 }} formatter={(v) => [fmtR(v)]} />
            <Line type="monotone" dataKey="acumulado" stroke="#f59e0b" strokeWidth={2.5} dot={{ fill: "#f59e0b", r: 4 }} name="Acumulado" />
            <Line type="monotone" dataKey="receita_retida" stroke="#3b82f6" strokeWidth={2} dot={{ fill: "#3b82f6", r: 3 }} strokeDasharray="4 2" name="Mensal" />
            <Legend formatter={(v) => <span style={{ color: "#d1d5db", fontSize: 11 }}>{v}</span>} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Tabela mensal */}
      <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
        <div className="p-4 border-b border-gray-800">
          <h2 className="text-white font-semibold text-sm uppercase tracking-wider">Detalhe Mensal — Retenção</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-xs">
              <th className="text-left px-5 py-3 text-gray-400 font-medium">Mês</th>
              <th className="text-right px-5 py-3 text-gray-400 font-medium">Receita Retida</th>
              <th className="text-right px-5 py-3 text-gray-400 font-medium">Clientes</th>
              <th className="text-right px-5 py-3 text-gray-400 font-medium">Vendas</th>
              <th className="text-right px-5 py-3 text-gray-400 font-medium">Acumulado</th>
            </tr>
          </thead>
          <tbody>
            {RETIDO_POR_MES.map((m) => (
              <tr key={m.mes} className="border-b border-gray-800 hover:bg-gray-800">
                <td className="px-5 py-3 text-gray-300 font-medium">{m.mes}</td>
                <td className="px-5 py-3 text-right text-yellow-400 font-semibold">{fmtR(m.receita_retida)}</td>
                <td className="px-5 py-3 text-right text-gray-300">{m.clientes}</td>
                <td className="px-5 py-3 text-right text-gray-300">{m.vendas}</td>
                <td className="px-5 py-3 text-right text-blue-400">{fmtR(m.acumulado)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}