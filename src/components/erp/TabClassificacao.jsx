import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useErpSource } from "@/lib/ErpSourceContext";
import { useGlobalFilter } from "@/lib/GlobalFilterContext";
import { fmtCur, fmtNum } from "@/lib/erpFormat";
import { Users, Loader2, Sparkles, Search } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";

const STATUS_META = {
  "Novo ativo":       { color: "#22c55e", border: "border-green-700/40", bg: "bg-green-950/30", text: "text-green-300" },
  "Recorrente":       { color: "#3b82f6", border: "border-blue-700/40",  bg: "bg-blue-950/30",  text: "text-blue-300" },
  "Reativado":        { color: "#06b6d4", border: "border-cyan-700/40",  bg: "bg-cyan-950/30",  text: "text-cyan-300" },
  "Em risco":         { color: "#f59e0b", border: "border-amber-700/40", bg: "bg-amber-950/30", text: "text-amber-300" },
  "Em churn":         { color: "#f97316", border: "border-orange-700/40",bg: "bg-orange-950/30",text: "text-orange-300" },
  "Dormente":         { color: "#a3a3a3", border: "border-gray-700/40",  bg: "bg-gray-900/40",  text: "text-gray-300" },
  "Churn confirmado": { color: "#ef4444", border: "border-red-700/40",   bg: "bg-red-950/30",   text: "text-red-300" },
  "Prospector":       { color: "#a855f7", border: "border-purple-700/40",bg: "bg-purple-950/30",text: "text-purple-300" },
  "Novo cadastro":    { color: "#6366f1", border: "border-indigo-700/40",bg:"bg-indigo-950/30",text: "text-indigo-300" },
};

export default function TabClassificacao() {
  const { selectedSource } = useErpSource();
  const { period } = useGlobalFilter();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const refStart = period?.start ? `${Number(String(period.start).slice(0, 4)) - 1}-01-01` : null;

  const handleClassify = async () => {
    if (!selectedSource) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await base44.functions.invoke("classifyClientStatus", {
        source_id: selectedSource.id,
        analysis_start: period.start,
        analysis_end: period.end,
        ref_start: refStart,
      });
      const data = res?.data || res;
      if (data?.success === false) setError(data.error || "Erro ao classificar");
      else setResult(data);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "Erro ao classificar");
    } finally {
      setLoading(false);
    }
  };

  const dist = result?.distribution || [];
  const totalClients = result?.total_clients || 0;
  const clients = result?.clients || [];

  const q = search.trim().toLowerCase();
  const filtered = clients.filter((c) => {
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (q && !(c.nm_pessoa?.toLowerCase().includes(q) || String(c.cd_pessoa).includes(q))) return false;
    return true;
  });

  const chartData = dist.map((d) => ({ status: d.status, count: d.count }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm text-gray-400">
          Classificação de clientes (9 status de ciclo de vida) · período {period?.start} → {period?.end}
          <span className="text-gray-600"> · referência {refStart}</span>
        </div>
        <button
          onClick={handleClassify}
          disabled={loading || !selectedSource}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {loading ? "Classificando..." : "Classificar clientes"}
        </button>
      </div>

      {error && <div className="bg-red-950/40 border border-red-800/40 rounded-lg px-4 py-3 text-red-300 text-sm">{error}</div>}

      {!result && !loading && (
        <div className="text-gray-500 p-8 text-center">
          <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
          Clique em "Classificar clientes" para gerar a distribuição de ciclo de vida dos clientes no período selecionado.
        </div>
      )}

      {result && (
        <>
          <div className="text-xs text-gray-500">
            {fmtNum(totalClients)} clientes classificados · {result.duration_ms ? `${(result.duration_ms / 1000).toFixed(1)}s` : ""} · {result.query_count} consultas
          </div>

          {/* Distribuição — 9 cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {dist.map((d) => {
              const m = STATUS_META[d.status] || STATUS_META["Dormente"];
              const pct = totalClients > 0 ? (d.count / totalClients * 100) : 0;
              return (
                <div key={d.status} className={`rounded-xl border p-3 ${m.border} ${m.bg}`}>
                  <div className={`text-xs font-medium ${m.text} mb-1`}>{d.status}</div>
                  <div className="text-2xl font-bold text-white">{fmtNum(d.count)}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">{pct.toFixed(1)}% · {fmtCur(d.revenue)}</div>
                </div>
              );
            })}
          </div>

          {/* Gráfico de distribuição */}
          {chartData.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="text-white font-semibold mb-4 text-sm">Distribuição por status</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" horizontal={false} />
                  <XAxis type="number" stroke="#666" fontSize={11} />
                  <YAxis type="category" dataKey="status" stroke="#999" fontSize={10} width={110} />
                  <Tooltip contentStyle={{ backgroundColor: "#111", border: "1px solid #333" }} formatter={(v) => fmtNum(v)} />
                  <Bar dataKey="count" name="Clientes" radius={[0, 4, 4, 0]}>
                    {chartData.map((d, i) => <Cell key={i} fill={STATUS_META[d.status]?.color || "#888"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Tabela de clientes */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                <Search className="w-4 h-4 text-purple-400" /> Clientes por status {statusFilter !== "all" && `(${statusFilter})`}
              </h3>
              <div className="flex items-center gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-purple-500"
                >
                  <option value="all">Todos os status</option>
                  {dist.map((d) => <option key={d.status} value={d.status}>{d.status} ({fmtNum(d.count)})</option>)}
                </select>
                <input
                  type="text"
                  placeholder="Buscar cliente…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500 w-48"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs uppercase border-b border-gray-800">
                    <th className="text-left py-2 px-3">Cliente</th>
                    <th className="text-left py-2 px-3">Status</th>
                    <th className="text-right py-2 px-3">Loc. período</th>
                    <th className="text-right py-2 px-3">Loc. ref.</th>
                    <th className="text-left py-2 px-3">Primeira remessa</th>
                    <th className="text-left py-2 px-3">Última remessa</th>
                    <th className="text-right py-2 px-3">Receita no período</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 200).map((c, i) => {
                    const m = STATUS_META[c.status] || STATUS_META["Dormente"];
                    return (
                      <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                        <td className="py-2 px-3 text-white">{c.nm_pessoa}</td>
                        <td className="py-2 px-3">
                          <span className={`text-xs px-2 py-0.5 rounded ${m.bg} ${m.text} border ${m.border}`}>{c.status}</span>
                        </td>
                        <td className="py-2 px-3 text-right text-gray-300">{fmtNum(c.cnt_a)}</td>
                        <td className="py-2 px-3 text-right text-gray-300">{fmtNum(c.cnt_r)}</td>
                        <td className="py-2 px-3 text-gray-400">{c.first_remessa || "—"}</td>
                        <td className="py-2 px-3 text-gray-400">{c.last_remessa || "—"}</td>
                        <td className="py-2 px-3 text-right text-green-400 font-medium">{fmtCur(c.revenue)}</td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} className="text-center text-gray-600 py-6">Nenhum cliente encontrado</td></tr>
                  )}
                </tbody>
              </table>
              {filtered.length > 200 && (
                <p className="text-gray-600 text-xs mt-2">Exibindo os primeiros 200 de {fmtNum(filtered.length)} clientes filtrados.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}