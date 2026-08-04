import { useState } from "react";
import { useErpAnalytics } from "@/lib/ErpAnalyticsContext";
import { getEmpresaLabel } from "@/lib/empresaLabels";
import { fmtCur, fmtNum } from "@/lib/erpFormat";
import AnalyticsFilterBar from "@/components/erp/AnalyticsFilterBar";
import { TrendingDown, BarChart3, FileText, AlertTriangle } from "lucide-react";
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

export default function TabFinanceiro() {
  const { data, loading, error } = useErpAnalytics();
  const [view, setView] = useState("cap_empresa"); // cap_empresa | cap_conta | balancete

  if (loading) return <div className="text-gray-500 p-8 text-center">Carregando financeiro…</div>;
  if (error) return <div className="text-red-400 p-8 text-center">Erro: {error}</div>;
  if (!data) return <div className="text-gray-500 p-8 text-center">Sem dados.</div>;

  const k = data.kpis || {};
  const capEmp = data.cap_by_empresa || [];
  const capConta = data.cap_by_conta || [];
  const balancete = data.plano_balancete || [];
  const monthly = (data.cap_monthly || []).map(r => ({
    label: `${["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][r.mes] || r.mes}/${String(r.ano).slice(2)}`,
    total: r.vl_total,
    aberto: r.vl_aberto,
    baixado: r.vl_baixado,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm text-gray-400">CAP (Contas a Pagar) + Balancete Financeiro Analítico</div>
        <AnalyticsFilterBar />
      </div>

      {/* KPIs — CAP */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-red-700/40 bg-red-950/30 p-4">
          <div className="flex items-center gap-2 mb-2"><TrendingDown className="w-4 h-4 text-red-400" /><span className="text-xs text-gray-400 uppercase">CAP Total</span></div>
          <div className="text-2xl font-bold text-white">{fmtCur(k.cap_total)}</div>
          <div className="text-xs text-red-400/60 mt-1">Período selecionado</div>
        </div>
        <div className="rounded-xl border border-amber-700/40 bg-amber-950/30 p-4">
          <div className="flex items-center gap-2 mb-2"><AlertTriangle className="w-4 h-4 text-amber-400" /><span className="text-xs text-gray-400 uppercase">CAP Em Aberto</span></div>
          <div className="text-2xl font-bold text-white">{fmtCur(k.cap_aberto)}</div>
          <div className="text-xs text-amber-400/60 mt-1">Não baixado</div>
        </div>
        <div className="rounded-xl border border-gray-700/40 bg-gray-900/40 p-4">
          <div className="flex items-center gap-2 mb-2"><FileText className="w-4 h-4 text-gray-400" /><span className="text-xs text-gray-400 uppercase">CAP Baixado</span></div>
          <div className="text-2xl font-bold text-white">{fmtCur(k.cap_baixado)}</div>
          <div className="text-xs text-gray-400/60 mt-1">Pago no período</div>
        </div>
        <div className="rounded-xl border border-red-700/40 bg-red-950/30 p-4">
          <div className="flex items-center gap-2 mb-2"><AlertTriangle className="w-4 h-4 text-red-400" /><span className="text-xs text-gray-400 uppercase">CAP Vencido</span></div>
          <div className="text-2xl font-bold text-white">{fmtCur(k.cap_vencido)}</div>
          <div className="text-xs text-red-400/60 mt-1">Vencido em aberto</div>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit flex-wrap">
        <button onClick={() => setView("cap_empresa")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === "cap_empresa" ? "bg-purple-600 text-white" : "text-gray-400 hover:text-gray-200"}`}>CAP por Empresa</button>
        <button onClick={() => setView("cap_conta")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === "cap_conta" ? "bg-purple-600 text-white" : "text-gray-400 hover:text-gray-200"}`}>CAP por Conta</button>
        <button onClick={() => setView("balancete")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === "balancete" ? "bg-purple-600 text-white" : "text-gray-400 hover:text-gray-200"}`}>Balancete Analítico</button>
      </div>

      {/* CAP mensal chart */}
      {monthly.length > 0 && view !== "balancete" && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4 text-sm flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-red-400" /> CAP — série mensal (DATA)
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222" />
              <XAxis dataKey="label" stroke="#666" fontSize={11} />
              <YAxis stroke="#666" fontSize={11} tickFormatter={(v) => fmtCur(v).replace("R$", "")} />
              <Tooltip contentStyle={{ backgroundColor: "#111", border: "1px solid #333" }} formatter={(v) => fmtCur(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="total" name="CAP Total" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="aberto" name="Em Aberto" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              <Line dataKey="baixado" name="Baixado" stroke="#fca5a5" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {view === "cap_empresa" && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4 text-sm">CAP por empresa (Contas a Pagar)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs uppercase border-b border-gray-800">
                  <th className="text-left py-2 px-3">Empresa</th>
                  <th className="text-right py-2 px-3">Qtd</th>
                  <th className="text-right py-2 px-3">Total</th>
                  <th className="text-right py-2 px-3">Em aberto</th>
                  <th className="text-right py-2 px-3">Baixado</th>
                  <th className="text-right py-2 px-3">Vencido</th>
                </tr>
              </thead>
              <tbody>
                {capEmp.map((r, i) => (
                  <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="py-2 px-3 text-white">{getEmpresaLabel(r.cd_empresa)}</td>
                    <td className="py-2 px-3 text-right text-gray-300">{fmtNum(r.qtd)}</td>
                    <td className="py-2 px-3 text-right text-red-400 font-medium">{fmtCur(r.vl_total)}</td>
                    <td className="py-2 px-3 text-right text-amber-400">{fmtCur(r.vl_aberto)}</td>
                    <td className="py-2 px-3 text-right text-gray-300">{fmtCur(r.vl_baixado)}</td>
                    <td className="py-2 px-3 text-right text-red-400">{fmtCur(r.vl_vencido)}</td>
                  </tr>
                ))}
                {capEmp.length === 0 && (
                  <tr><td colSpan={6} className="text-center text-gray-600 py-6">Sem dados de CAP por empresa</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === "cap_conta" && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4 text-sm">CAP por conta contábil (Contas a Pagar)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs uppercase border-b border-gray-800">
                  <th className="text-left py-2 px-3">Conta</th>
                  <th className="text-right py-2 px-3">Qtd</th>
                  <th className="text-right py-2 px-3">Total</th>
                  <th className="text-right py-2 px-3">Em aberto</th>
                  <th className="text-right py-2 px-3">Baixado</th>
                  <th className="text-right py-2 px-3">Vencido</th>
                </tr>
              </thead>
              <tbody>
                {capConta.map((r, i) => {
                  const planoMatch = balancete.find(p => p.cd_planfin === r.cd_conta);
                  return (
                    <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="py-2 px-3 text-white">{planoMatch?.ds_planfin || `Conta ${r.cd_conta}`}</td>
                      <td className="py-2 px-3 text-right text-gray-300">{fmtNum(r.qtd)}</td>
                      <td className="py-2 px-3 text-right text-red-400 font-medium">{fmtCur(r.vl_total)}</td>
                      <td className="py-2 px-3 text-right text-amber-400">{fmtCur(r.vl_aberto)}</td>
                      <td className="py-2 px-3 text-right text-gray-300">{fmtCur(r.vl_baixado)}</td>
                      <td className="py-2 px-3 text-right text-red-400">{fmtCur(r.vl_vencido)}</td>
                    </tr>
                  );
                })}
                {capConta.length === 0 && (
                  <tr><td colSpan={6} className="text-center text-gray-600 py-6">Sem dados</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === "balancete" && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4 text-sm">Balancete financeiro analítico (Plano de Contas × CAP)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs uppercase border-b border-gray-800">
                  <th className="text-left py-2 px-3">Conta</th>
                  <th className="text-left py-2 px-3">Descrição</th>
                  <th className="text-left py-2 px-3">Classe</th>
                  <th className="text-right py-2 px-3">Lançamentos</th>
                  <th className="text-right py-2 px-3">Total</th>
                  <th className="text-right py-2 px-3">Em aberto</th>
                  <th className="text-right py-2 px-3">Baixado</th>
                </tr>
              </thead>
              <tbody>
                {balancete.map((r, i) => (
                  <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="py-2 px-3 text-gray-400 font-mono text-xs">{r.nr_planfin}</td>
                    <td className="py-2 px-3 text-white">{r.ds_planfin}</td>
                    <td className="py-2 px-3 text-gray-400">{r.fl_cla_planfin || "—"}</td>
                    <td className="py-2 px-3 text-right text-gray-300">{fmtNum(r.qtd)}</td>
                    <td className="py-2 px-3 text-right text-white font-medium">{fmtCur(r.vl_total)}</td>
                    <td className="py-2 px-3 text-right text-amber-400">{fmtCur(r.vl_aberto)}</td>
                    <td className="py-2 px-3 text-right text-gray-300">{fmtCur(r.vl_baixado)}</td>
                  </tr>
                ))}
                {balancete.length === 0 && (
                  <tr><td colSpan={7} className="text-center text-gray-600 py-6">Sem dados de balancete</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}