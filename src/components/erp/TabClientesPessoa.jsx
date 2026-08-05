import { useState } from "react";
import { useAnalyticsView } from "@/lib/analyticsView";
import { fmtCur, fmtNum } from "@/lib/erpFormat";
import { Users, UserPlus, Search, TrendingUp } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

export default function TabClientesPessoa() {
  const { analytics, view, loading, dateRange } = useAnalyticsView();
  const [search, setSearch] = useState("");

  if (loading && !analytics) return <div className="text-gray-500 p-8 text-center">Carregando clientes…</div>;
  if (!analytics || !view) return <div className="text-gray-500 p-8 text-center">Sem dados. Clique em "Atualizar dados" para carregar.</div>;

  const topLoc = analytics.fichloc_top_clientes || [];
  const newClientsMonthly = (analytics.new_clients_monthly || []).map(r => ({
    label: `${["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][r.mes] || r.mes}/${String(r.ano).slice(2)}`,
    qtd: r.qtd,
  }));
  const k = view.kpis;
  const totalFichas = topLoc.reduce((s, r) => s + (r.qtd_loc || 0), 0);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? topLoc.filter(c => c.nm_pessoa?.toLowerCase().includes(q) || String(c.cd_pessoa).includes(q))
    : topLoc;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm text-gray-400">PESSOA × FICH_LOC (universo de locação) · período {dateRange?.start} → {dateRange?.end}</div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-700/40 bg-gray-900/40 p-4">
          <div className="flex items-center gap-2 mb-2"><Users className="w-4 h-4 text-gray-400" /><span className="text-xs text-gray-400 uppercase">Clientes ativos (locação)</span></div>
          <div className="text-2xl font-bold text-white">{fmtNum(k.fichloc_clientes_ativos || 0)}</div>
          <div className="text-xs text-gray-500 mt-1">Que alugaram no período</div>
        </div>
        <div className="rounded-xl border border-purple-700/40 bg-purple-950/30 p-4">
          <div className="flex items-center gap-2 mb-2"><TrendingUp className="w-4 h-4 text-purple-400" /><span className="text-xs text-gray-400 uppercase">Fichas (top20)</span></div>
          <div className="text-2xl font-bold text-white">{fmtNum(totalFichas)}</div>
          <div className="text-xs text-gray-500 mt-1">Contratos de locação</div>
        </div>
        <div className="rounded-xl border border-amber-700/40 bg-amber-950/30 p-4">
          <div className="flex items-center gap-2 mb-2"><UserPlus className="w-4 h-4 text-amber-400" /><span className="text-xs text-gray-400 uppercase">Novos clientes (12m)</span></div>
          <div className="text-2xl font-bold text-white">{fmtNum(newClientsMonthly.reduce((s, r) => s + r.qtd, 0))}</div>
          <div className="text-xs text-gray-500 mt-1">Primeira locação</div>
        </div>
      </div>

      {/* New clients chart */}
      {newClientsMonthly.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4 text-sm">Novos clientes de locação por mês (primeira ficha)</h3>
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

      {/* Top clients table — PESSOA × FICH_LOC */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold text-sm flex items-center gap-2">
            <Search className="w-4 h-4 text-purple-400" /> Top 20 clientes por locação (FICH_LOC)
          </h3>
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
                <th className="text-left py-2 px-3">Cliente (PESSOA)</th>
                <th className="text-right py-2 px-3">Fichas</th>
                <th className="text-right py-2 px-3">Ativas</th>
                <th className="text-right py-2 px-3">Vl. mínimo</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="py-2 px-3 text-gray-500">{i + 1}</td>
                  <td className="py-2 px-3 text-white">{c.nm_pessoa}</td>
                  <td className="py-2 px-3 text-right text-gray-300">{fmtNum(c.qtd_loc)}</td>
                  <td className="py-2 px-3 text-right text-purple-400">{fmtNum(c.qtd_ativas)}</td>
                  <td className="py-2 px-3 text-right text-green-400 font-medium">{fmtCur(c.vl_minimo)}</td>
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