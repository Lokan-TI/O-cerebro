import { useErpAnalytics } from "@/lib/ErpAnalyticsContext";
import { getEmpresaLabel } from "@/lib/empresaLabels";
import { fmtCur, fmtNum } from "@/lib/erpFormat";
import AnalyticsFilterBar from "@/components/erp/AnalyticsFilterBar";
import { FileText, CalendarClock, CheckCircle2, Package, Users } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

export default function TabLocacoes() {
  const { data, loading, error } = useErpAnalytics();

  if (loading) return <div className="text-gray-500 p-8 text-center">Carregando locações…</div>;
  if (error) return <div className="text-red-400 p-8 text-center">Erro: {error}</div>;
  if (!data) return <div className="text-gray-500 p-8 text-center">Sem dados.</div>;

  const fichEmp = data.fichloc_by_empresa || [];
  const fichMon = data.fichloc_monthly || [];
  const topClientesLoc = data.fichloc_top_clientes || [];
  const k = data.kpis || {};

  const monthlyChart = fichMon.map(r => ({
    label: `${["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][r.mes] || r.mes}/${String(r.ano).slice(2)}`,
    novas: r.qtd,
    encerradas: r.qtd_encerradas,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm text-gray-400">Ficha de Locação × PESSOA × DATA</div>
        <AnalyticsFilterBar />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-purple-700/40 bg-purple-950/30 p-4">
          <div className="flex items-center gap-2 mb-2"><FileText className="w-4 h-4 text-purple-400" /><span className="text-xs text-gray-400 uppercase">Total locações</span></div>
          <div className="text-2xl font-bold text-white">{fmtNum(k.fichloc_total)}</div>
        </div>
        <div className="rounded-xl border border-green-700/40 bg-green-950/30 p-4">
          <div className="flex items-center gap-2 mb-2"><CalendarClock className="w-4 h-4 text-green-400" /><span className="text-xs text-gray-400 uppercase">Ativas</span></div>
          <div className="text-2xl font-bold text-white">{fmtNum(k.fichloc_ativas)}</div>
        </div>
        <div className="rounded-xl border border-gray-700/40 bg-gray-900/40 p-4">
          <div className="flex items-center gap-2 mb-2"><CheckCircle2 className="w-4 h-4 text-gray-400" /><span className="text-xs text-gray-400 uppercase">Encerradas</span></div>
          <div className="text-2xl font-bold text-white">{fmtNum(k.fichloc_encerradas)}</div>
        </div>
        <div className="rounded-xl border border-blue-700/40 bg-blue-950/30 p-4">
          <div className="flex items-center gap-2 mb-2"><Package className="w-4 h-4 text-blue-400" /><span className="text-xs text-gray-400 uppercase">Vl. mínimo</span></div>
          <div className="text-2xl font-bold text-white">{fmtCur(fichEmp.reduce((s, r) => s + (r.vl_minimo || 0), 0))}</div>
        </div>
      </div>

      {/* Monthly chart */}
      {monthlyChart.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4 text-sm">Novas locações × Encerradas por mês (DATA)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222" />
              <XAxis dataKey="label" stroke="#666" fontSize={11} />
              <YAxis stroke="#666" fontSize={11} />
              <Tooltip contentStyle={{ backgroundColor: "#111", border: "1px solid #333" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="novas" name="Novas" fill="#a855f7" radius={[4, 4, 0, 0]} />
              <Bar dataKey="encerradas" name="Encerradas" fill="#52525b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* By empresa */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-white font-semibold mb-4 text-sm">Locações por empresa</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs uppercase border-b border-gray-800">
                <th className="text-left py-2 px-3">Empresa</th>
                <th className="text-right py-2 px-3">Total</th>
                <th className="text-right py-2 px-3">Ativas</th>
                <th className="text-right py-2 px-3">Encerradas</th>
                <th className="text-right py-2 px-3">Vl. mínimo</th>
                <th className="text-right py-2 px-3">Vl. encerramento</th>
              </tr>
            </thead>
            <tbody>
              {fichEmp.map((r, i) => (
                <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="py-2 px-3 text-white">{getEmpresaLabel(r.cd_empresa)}</td>
                  <td className="py-2 px-3 text-right text-white font-medium">{fmtNum(r.qtd)}</td>
                  <td className="py-2 px-3 text-right text-green-400">{fmtNum(r.qtd_ativas)}</td>
                  <td className="py-2 px-3 text-right text-gray-300">{fmtNum(r.qtd_encerradas)}</td>
                  <td className="py-2 px-3 text-right text-blue-400">{fmtCur(r.vl_minimo)}</td>
                  <td className="py-2 px-3 text-right text-gray-300">{fmtCur(r.vl_encerramento)}</td>
                </tr>
              ))}
              {fichEmp.length === 0 && (
                <tr><td colSpan={6} className="text-center text-gray-600 py-6">Sem dados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top clientes por locação (fich_loc × PESSOA) */}
      {topClientesLoc.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4 text-sm flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-400" /> Top 20 clientes por locações (Ficha × PESSOA)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs uppercase border-b border-gray-800">
                  <th className="text-left py-2 px-3">#</th>
                  <th className="text-left py-2 px-3">Cliente (PESSOA)</th>
                  <th className="text-right py-2 px-3">Locações</th>
                  <th className="text-right py-2 px-3">Ativas</th>
                  <th className="text-right py-2 px-3">Vl. mínimo</th>
                </tr>
              </thead>
              <tbody>
                {topClientesLoc.map((r, i) => (
                  <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="py-2 px-3 text-gray-500">{i + 1}</td>
                    <td className="py-2 px-3 text-white">{r.nm_pessoa}</td>
                    <td className="py-2 px-3 text-right text-purple-400 font-medium">{fmtNum(r.qtd_loc)}</td>
                    <td className="py-2 px-3 text-right text-green-400">{fmtNum(r.qtd_ativas)}</td>
                    <td className="py-2 px-3 text-right text-blue-400">{fmtCur(r.vl_minimo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}