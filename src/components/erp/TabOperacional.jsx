import { useAnalyticsView } from "@/lib/analyticsView";
import { fmtNum } from "@/lib/erpFormat";
import { Package, ArrowRightLeft, Calendar } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

export default function TabOperacional() {
  const { analytics, view, loading, dateRange } = useAnalyticsView();

  if (loading && !analytics) return <div className="text-gray-500 p-8 text-center">Carregando operacional…</div>;
  if (!analytics || !view) return <div className="text-gray-500 p-8 text-center">Sem dados. Clique em "Atualizar dados" para carregar.</div>;

  const byOp = analytics.est_mov_by_operacao || [];
  const monthly = (analytics.est_mov_monthly || []).map(r => ({
    label: `${["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][r.mes] || r.mes}/${String(r.ano).slice(2)}`,
    qtd: r.qtd,
  }));
  const total = byOp.reduce((s, r) => s + (r.qtd || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm text-gray-400">Movimentações de Estoque × DATA · período {dateRange?.start} → {dateRange?.end}</div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-blue-700/40 bg-blue-950/30 p-4">
          <div className="flex items-center gap-2 mb-2"><Package className="w-4 h-4 text-blue-400" /><span className="text-xs text-gray-400 uppercase">Total movimentações</span></div>
          <div className="text-2xl font-bold text-white">{fmtNum(total)}</div>
        </div>
        <div className="rounded-xl border border-purple-700/40 bg-purple-950/30 p-4">
          <div className="flex items-center gap-2 mb-2"><ArrowRightLeft className="w-4 h-4 text-purple-400" /><span className="text-xs text-gray-400 uppercase">Tipos de operação</span></div>
          <div className="text-2xl font-bold text-white">{fmtNum(byOp.length)}</div>
        </div>
        <div className="rounded-xl border border-gray-700/40 bg-gray-900/40 p-4">
          <div className="flex items-center gap-2 mb-2"><Package className="w-4 h-4 text-gray-400" /><span className="text-xs text-gray-400 uppercase">Controles únicos</span></div>
          <div className="text-2xl font-bold text-white">{fmtNum(byOp.reduce((s, r) => s + (r.qtd_controles || 0), 0))}</div>
        </div>
      </div>

      {/* Monthly chart */}
      {monthly.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4 text-sm flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-400" /> Movimentações por mês (DATA)
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222" />
              <XAxis dataKey="label" stroke="#666" fontSize={11} />
              <YAxis stroke="#666" fontSize={11} />
              <Tooltip contentStyle={{ backgroundColor: "#111", border: "1px solid #333" }} />
              <Bar dataKey="qtd" name="Movimentações" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* By operation table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-white font-semibold mb-4 text-sm">Movimentações por tipo de operação</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs uppercase border-b border-gray-800">
                <th className="text-left py-2 px-3">Operação</th>
                <th className="text-right py-2 px-3">Qtd</th>
                <th className="text-right py-2 px-3">Controles únicos</th>
                <th className="text-right py-2 px-3">% do total</th>
              </tr>
            </thead>
            <tbody>
              {byOp.map((r, i) => (
                <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="py-2 px-3 text-white">{r.ds_movoperacao}</td>
                  <td className="py-2 px-3 text-right text-blue-400 font-medium">{fmtNum(r.qtd)}</td>
                  <td className="py-2 px-3 text-right text-gray-300">{fmtNum(r.qtd_controles)}</td>
                  <td className="py-2 px-3 text-right text-gray-400">{total > 0 ? ((r.qtd / total) * 100).toFixed(1) : "0"}%</td>
                </tr>
              ))}
              {byOp.length === 0 && (
                <tr><td colSpan={4} className="text-center text-gray-600 py-6">Sem dados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}