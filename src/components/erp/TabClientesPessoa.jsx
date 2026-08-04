import { useState } from "react";
import { useErpAnalytics } from "@/lib/ErpAnalyticsContext";
import { fmtCur, fmtNum, fmtMonthLabel } from "@/lib/erpFormat";
import { Users, UserPlus, Search } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

export default function TabClientesPessoa() {
  const { data, loading, error } = useErpAnalytics();
  const [search, setSearch] = useState("");

  if (loading) return <div className="text-gray-500 p-8 text-center">Carregando clientes…</div>;
  if (error) return <div className="text-red-400 p-8 text-center">Erro: {error}</div>;
  if (!data) return <div className="text-gray-500 p-8 text-center">Sem dados.</div>;

  const topClients = data.top_clients_car || [];
  const newClientsMonthly = (data.new_clients_monthly || []).map(r => ({
    label: fmtMonthLabel(r.mes, r.ano),
    qtd: r.qtd,
  }));

  const q = search.trim().toLowerCase();
  const filtered = q
    ? topClients.filter(c => c.nm_pessoa?.toLowerCase().includes(q) || String(c.cd_pessoa).includes(q))
    : topClients;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-700/40 bg-gray-900/40 p-4">
          <div className="flex items-center gap-2 mb-2"><Users className="w-4 h-4 text-gray-400" /><span className="text-xs text-gray-400 uppercase">Top clientes CAR</span></div>
          <div className="text-2xl font-bold text-white">{fmtNum(topClients.length)}</div>
        </div>
        <div className="rounded-xl border border-blue-700/40 bg-blue-950/30 p-4">
          <div className="flex items-center gap-2 mb-2"><Search className="w-4 h-4 text-blue-400" /><span className="text-xs text-gray-400 uppercase">CAR total top50</span></div>
          <div className="text-2xl font-bold text-white">{fmtCur(topClients.reduce((s, r) => s + (r.vl_total || 0), 0))}</div>
        </div>
        <div className="rounded-xl border border-amber-700/40 bg-amber-950/30 p-4">
          <div className="flex items-center gap-2 mb-2"><UserPlus className="w-4 h-4 text-amber-400" /><span className="text-xs text-gray-400 uppercase">Novos cadastros (12m)</span></div>
          <div className="text-2xl font-bold text-white">{fmtNum(newClientsMonthly.reduce((s, r) => s + r.qtd, 0))}</div>
        </div>
      </div>

      {/* New clients chart */}
      {newClientsMonthly.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4 text-sm">Novos cadastros de pessoa por mês</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={newClientsMonthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222" />
              <XAxis dataKey="label" stroke="#666" fontSize={11} />
              <YAxis stroke="#666" fontSize={11} />
              <Tooltip contentStyle={{ backgroundColor: "#111", border: "1px solid #333" }} />
              <Bar dataKey="qtd" name="Novos clientes" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top clients table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold text-sm">Top 50 clientes por CAR (Contas a Receber)</h3>
          <input
            type="text"
            placeholder="Buscar cliente…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500 w-48"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs uppercase border-b border-gray-800">
                <th className="text-left py-2 px-3">#</th>
                <th className="text-left py-2 px-3">Cliente</th>
                <th className="text-right py-2 px-3">Títulos</th>
                <th className="text-right py-2 px-3">Total CAR</th>
                <th className="text-right py-2 px-3">Em aberto</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="py-2 px-3 text-gray-500">{i + 1}</td>
                  <td className="py-2 px-3 text-white">{c.nm_pessoa}</td>
                  <td className="py-2 px-3 text-right text-gray-300">{fmtNum(c.qtd_car)}</td>
                  <td className="py-2 px-3 text-right text-green-400 font-medium">{fmtCur(c.vl_total)}</td>
                  <td className="py-2 px-3 text-right text-amber-400">{fmtCur(c.vl_aberto)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="text-center text-gray-600 py-6">Nenhum cliente encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}