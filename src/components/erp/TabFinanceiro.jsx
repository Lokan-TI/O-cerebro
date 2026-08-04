import { useState } from "react";
import { useErpAnalytics } from "@/lib/ErpAnalyticsContext";
import { fmtCur, fmtNum, fmtMonthLabel } from "@/lib/erpFormat";
import { TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart,
} from "recharts";

export default function TabFinanceiro() {
  const { data, loading, error, year } = useErpAnalytics();
  const [view, setView] = useState("comparativo"); // comparativo | balancete

  if (loading) return <div className="text-gray-500 p-8 text-center">Carregando financeiro…</div>;
  if (error) return <div className="text-red-400 p-8 text-center">Erro: {error}</div>;
  if (!data) return <div className="text-gray-500 p-8 text-center">Sem dados.</div>;

  // Merge CAR + CAP monthly into a single series
  const monthMap = {};
  (data.car_monthly || []).forEach(r => {
    const key = `${r.ano}-${r.mes}`;
    monthMap[key] = { ...monthMap[key], label: fmtMonthLabel(r.mes, r.ano), car: r.vl_total, car_baixado: r.vl_baixado };
  });
  (data.cap_monthly || []).forEach(r => {
    const key = `${r.ano}-${r.mes}`;
    monthMap[key] = { ...monthMap[key], label: fmtMonthLabel(r.mes, r.ano), cap: r.vl_total, cap_baixado: r.vl_baixado };
  });
  const monthlySeries = Object.values(monthMap).sort((a, b) => a.label.localeCompare(b.label));

  const k = data.kpis || {};

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
        <button onClick={() => setView("comparativo")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === "comparativo" ? "bg-purple-600 text-white" : "text-gray-400 hover:text-gray-200"}`}>CAR vs CAP</button>
        <button onClick={() => setView("balancete")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === "balancete" ? "bg-purple-600 text-white" : "text-gray-400 hover:text-gray-200"}`}>Balancete Analítico</button>
      </div>

      {view === "comparativo" && (
        <>
          {/* KPI summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-xl border border-green-700/40 bg-green-950/30 p-4">
              <div className="flex items-center gap-2 mb-2"><TrendingUp className="w-4 h-4 text-green-400" /><span className="text-xs text-gray-400 uppercase">CAR Total</span></div>
              <div className="text-2xl font-bold text-white">{fmtCur(k.car_total)}</div>
              <div className="text-xs text-green-400/60 mt-1">{fmtCur(k.car_aberto)} em aberto</div>
            </div>
            <div className="rounded-xl border border-red-700/40 bg-red-950/30 p-4">
              <div className="flex items-center gap-2 mb-2"><TrendingDown className="w-4 h-4 text-red-400" /><span className="text-xs text-gray-400 uppercase">CAP Total</span></div>
              <div className="text-2xl font-bold text-white">{fmtCur(k.cap_total)}</div>
              <div className="text-xs text-red-400/60 mt-1">{fmtCur(k.cap_aberto)} em aberto</div>
            </div>
            <div className="rounded-xl border border-purple-700/40 bg-purple-950/30 p-4">
              <div className="flex items-center gap-2 mb-2"><BarChart3 className="w-4 h-4 text-purple-400" /><span className="text-xs text-gray-400 uppercase">Margem Fluxo</span></div>
              <div className="text-2xl font-bold text-white">{fmtCur(k.margem_fluxo)}</div>
              <div className="text-xs text-purple-400/60 mt-1">{k.margem_percent != null ? `${k.margem_percent.toFixed(1)}%` : "—"}</div>
            </div>
            <div className="rounded-xl border border-amber-700/40 bg-amber-950/30 p-4">
              <div className="flex items-center gap-2 mb-2"><TrendingDown className="w-4 h-4 text-amber-400" /><span className="text-xs text-gray-400 uppercase">CAP Vencido</span></div>
              <div className="text-2xl font-bold text-white">{fmtCur(k.cap_aberto - k.cap_baixado)}</div>
              <div className="text-xs text-amber-400/60 mt-1">Não baixado</div>
            </div>
          </div>

          {/* Monthly chart */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-white font-semibold mb-4 text-sm">CAR vs CAP — série mensal</h3>
            <ResponsiveContainer width="100%" height={350}>
              <ComposedChart data={monthlySeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                <XAxis dataKey="label" stroke="#666" fontSize={11} />
                <YAxis stroke="#666" fontSize={11} tickFormatter={(v) => fmtCur(v).replace("R$", "")} />
                <Tooltip contentStyle={{ backgroundColor: "#111", border: "1px solid #333" }} formatter={(v) => fmtCur(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="car" name="CAR" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cap" name="CAP" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Line dataKey="car_baixado" name="CAR Baixado" stroke="#86efac" strokeWidth={2} dot={false} />
                <Line dataKey="cap_baixado" name="CAP Baixado" stroke="#fca5a5" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* CAP por conta table */}
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
                  </tr>
                </thead>
                <tbody>
                  {(data.cap_by_conta || []).map((r, i) => {
                    const planoMatch = (data.plano_balancete || []).find(p => p.cd_planfin === r.cd_conta);
                    return (
                      <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                        <td className="py-2 px-3 text-white">{planoMatch?.ds_planfin || `Conta ${r.cd_conta}`}</td>
                        <td className="py-2 px-3 text-right text-gray-300">{fmtNum(r.qtd)}</td>
                        <td className="py-2 px-3 text-right text-red-400 font-medium">{fmtCur(r.vl_total)}</td>
                        <td className="py-2 px-3 text-right text-amber-400">{fmtCur(r.vl_aberto)}</td>
                        <td className="py-2 px-3 text-right text-gray-300">{fmtCur(r.vl_baixado)}</td>
                      </tr>
                    );
                  })}
                  {(data.cap_by_conta || []).length === 0 && (
                    <tr><td colSpan={5} className="text-center text-gray-600 py-6">Sem dados</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
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
                {(data.plano_balancete || []).map((r, i) => (
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
                {(data.plano_balancete || []).length === 0 && (
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