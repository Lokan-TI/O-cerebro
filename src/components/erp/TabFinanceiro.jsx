import { useState } from "react";
import TabFornecedores from "@/components/erp/TabFornecedores";
import FinanceiroExportTab from "@/components/erp/FinanceiroExportTab";
import TotvsSaneamentoTab from "@/components/erp/TotvsSaneamentoTab";
import CapPorContaTab from "@/components/erp/CapPorContaTab";
import { useAnalyticsView } from "@/lib/analyticsView";
import { useErpSnapshot } from "@/lib/ErpSnapshotContext";
import { useEmpresaFilter } from "@/lib/EmpresaFilterContext";
import { getEmpresaLabel } from "@/lib/empresaLabels";
import { fmtCur, fmtNum, fmtMonthLabel } from "@/lib/erpFormat";
import {
  TrendingUp, TrendingDown, AlertTriangle, FileText, Calculator, BarChart3,
} from "lucide-react";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from "recharts";

export default function TabFinanceiro() {
  const { analytics, view: aView, loading, dateRange } = useAnalyticsView();
  const { snapshot } = useErpSnapshot();
  const { selectedEmpresa } = useEmpresaFilter();
  const [sub, setSub] = useState("resumo"); // resumo | car_empresa | cap_conta | balancete

  if (loading && !analytics) return <div className="text-gray-500 p-8 text-center">Carregando financeiro…</div>;
  if (!analytics || !aView) return <div className="text-gray-500 p-8 text-center">Sem dados. Clique em "Atualizar dados" para carregar.</div>;

  const k = aView.kpis;
  const isAll = aView.isAll;

  // Receita vem do snapshot (por empresa quando filtrada)
  const byEmp = snapshot?.by_empresa || [];
  const empRow = !isAll ? byEmp.find((e) => e.cd_empresa === selectedEmpresa) : null;
  const receita = isAll ? snapshot?.kpis?.fat_ano : empRow?.fat_ano || 0;
  const receitaAnt = isAll ? snapshot?.kpis?.fat_ano_ant : empRow?.fat_ano_ant || 0;
  const crescimento = isAll ? snapshot?.kpis?.crescimento_ano : empRow?.crescimento_ano ?? null;
  const gerada = k.receita_gerada;
  const diff = gerada != null ? receita - gerada : null;
  const pct = gerada != null && gerada > 0 ? (diff / gerada * 100) : null;

  const carEmp = aView.carByEmp;
  const balancete = analytics.plano_balancete || [];

  const carVsCapMonthly = (analytics.car_vs_cap_monthly || []).map((r) => ({
    label: r.label || fmtMonthLabel(r.mes, r.ano), car: r.car || 0, cap: r.cap || 0,
    car_baixado: r.car_baixado || 0, cap_baixado: r.cap_baixado || 0,
  }));

  const resultado = receita - (k.cap_total || 0);
  const margemResult = receita > 0 ? (resultado / receita * 100) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm text-gray-400">
          Financeiro —{" "}
          <span className="text-white font-medium">
            {isAll ? "Todas as empresas (consolidado)" : getEmpresaLabel(selectedEmpresa, empRow?.nm_empresa)}
          </span>
          <span className="text-gray-600"> · período {dateRange?.start} → {dateRange?.end}</span>
        </div>
      </div>

      {/* KPIs principais — 4 blocos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-green-700/40 bg-green-950/30 p-4">
          <div className="flex items-center gap-2 mb-2"><TrendingUp className="w-4 h-4 text-green-400" /><span className="text-xs text-gray-400 uppercase">Receita realizada</span></div>
          <div className="text-2xl font-bold text-white">{fmtCur(receita)}</div>
          <div className="text-xs text-gray-500 mt-1">
            Ano anterior: {fmtCur(receitaAnt)}
            {crescimento != null && (<> · <span className={crescimento >= 0 ? "text-green-400" : "text-red-400"}>{crescimento >= 0 ? "+" : ""}{crescimento.toFixed(1)}%</span></>)}
          </div>
        </div>
        <div className="rounded-xl border border-blue-700/40 bg-blue-950/30 p-4">
          <div className="flex items-center gap-2 mb-2"><FileText className="w-4 h-4 text-blue-400" /><span className="text-xs text-gray-400 uppercase">Contas a Receber</span></div>
          <div className="text-2xl font-bold text-white">{fmtCur(k.car_total)}</div>
          <div className="text-xs text-blue-400/60 mt-1">Em aberto: {fmtCur(k.car_aberto)} · Vencido: {fmtCur(k.car_vencido)}</div>
        </div>
        <div className="rounded-xl border border-red-700/40 bg-red-950/30 p-4">
          <div className="flex items-center gap-2 mb-2"><TrendingDown className="w-4 h-4 text-red-400" /><span className="text-xs text-gray-400 uppercase">Contas a Pagar</span></div>
          <div className="text-2xl font-bold text-white">{fmtCur(k.cap_total)}</div>
          <div className="text-xs text-red-400/60 mt-1">Em aberto: {fmtCur(k.cap_aberto)} · Vencido: {fmtCur(k.cap_vencido)}</div>
        </div>
        <div className={`rounded-xl border p-4 ${resultado >= 0 ? "border-purple-700/40 bg-purple-950/30" : "border-red-700/40 bg-red-950/30"}`}>
          <div className="flex items-center gap-2 mb-2"><Calculator className="w-4 h-4 text-purple-400" /><span className="text-xs text-gray-400 uppercase">Resultado oper. estimado</span></div>
          <div className="text-2xl font-bold text-white">{fmtCur(resultado)}</div>
          <div className="text-xs text-gray-500 mt-1">
            {margemResult != null ? `${margemResult.toFixed(1)}% de margem · ` : ""}Receita − CAP
          </div>
        </div>
      </div>

      {/* Receita gerada (pré-faturamento) vs realizada (NFs emitidas) */}
      {gerada != null && (
        <div className="bg-gray-900 border border-cyan-800/40 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-cyan-400" />
            <span className="text-xs text-gray-400 uppercase tracking-wide">Receita gerada vs realizada</span>
            <span className="text-xs text-gray-600">· pré-faturamento</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg bg-cyan-950/30 border border-cyan-800/30 p-3">
              <div className="text-xs text-gray-500 mb-1">Receita gerada (fl_fatura)</div>
              <div className="text-xl font-bold text-cyan-300">{fmtCur(gerada)}</div>
              <div className="text-xs text-gray-600 mt-1">Valor operacional pré-faturamento</div>
            </div>
            <div className="rounded-lg bg-green-950/30 border border-green-800/30 p-3">
              <div className="text-xs text-gray-500 mb-1">Receita realizada (NFs emitidas)</div>
              <div className="text-xl font-bold text-green-400">{fmtCur(receita)}</div>
              <div className="text-xs text-gray-600 mt-1">Notas fiscais emitidas no período</div>
            </div>
            <div className={`rounded-lg p-3 border ${diff >= 0 ? "bg-gray-800/40 border-gray-700" : "bg-red-950/30 border-red-800/30"}`}>
              <div className="text-xs text-gray-500 mb-1">Diferença (realizada − gerada)</div>
              <div className={`text-xl font-bold ${diff >= 0 ? "text-white" : "text-red-400"}`}>{fmtCur(diff)}</div>
              <div className="text-xs text-gray-600 mt-1">{pct != null ? `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}% vs gerada` : "—"}</div>
            </div>
          </div>
        </div>
      )}

      {/* Aviso: CAP sem dimensão empresa */}
      {!isAll && (
        <div className="bg-amber-950/30 border border-amber-800/40 rounded-lg px-4 py-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-amber-300 text-xs">Contas a Pagar (CAP) não possuem dimensão de empresa no SISLOC — exibidas em consolidado.</span>
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit flex-wrap">
        <button onClick={() => setSub("resumo")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${sub === "resumo" ? "bg-purple-600 text-white" : "text-gray-400 hover:text-gray-200"}`}>Resumo mensal</button>
        <button onClick={() => setSub("car_empresa")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${sub === "car_empresa" ? "bg-purple-600 text-white" : "text-gray-400 hover:text-gray-200"}`}>CAR por empresa</button>
        <button onClick={() => setSub("cap_conta")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${sub === "cap_conta" ? "bg-purple-600 text-white" : "text-gray-400 hover:text-gray-200"}`}>CAP por conta</button>
        <button onClick={() => setSub("balancete")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${sub === "balancete" ? "bg-purple-600 text-white" : "text-gray-400 hover:text-gray-200"}`}>Balancete</button>
        <button onClick={() => setSub("fornecedores")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${sub === "fornecedores" ? "bg-purple-600 text-white" : "text-gray-400 hover:text-gray-200"}`}>Fornecedores</button>
        <button onClick={() => setSub("exportar")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${sub === "exportar" ? "bg-purple-600 text-white" : "text-gray-400 hover:text-gray-200"}`}>Exportar CAP/CAR</button>
        <button onClick={() => setSub("totvs")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${sub === "totvs" ? "bg-purple-600 text-white" : "text-gray-400 hover:text-gray-200"}`}>Saneamento TOTVS</button>
      </div>

      {sub === "totvs" && <TotvsSaneamentoTab />}

      {sub === "fornecedores" && <TabFornecedores />}

      {sub === "exportar" && <FinanceiroExportTab empresas={carEmp.map((r) => r.cd_empresa)} />}

      {/* Resumo mensal: CAR vs CAP */}
      {sub === "resumo" && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4 text-sm flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-purple-400" /> CAR vs CAP — série mensal
          </h3>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={carVsCapMonthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222" />
              <XAxis dataKey="label" stroke="#666" fontSize={11} />
              <YAxis stroke="#666" fontSize={11} tickFormatter={(v) => fmtCur(v).replace("R$", "")} />
              <Tooltip contentStyle={{ backgroundColor: "#111", border: "1px solid #333" }} formatter={(v) => fmtCur(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="car" name="CAR (Receber)" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="cap" name="CAP (Pagar)" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* CAR por empresa */}
      {sub === "car_empresa" && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4 text-sm">Contas a Receber (CAR) por empresa</h3>
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
                {carEmp.map((r, i) => (
                  <tr key={i} className={`border-b border-gray-800/50 hover:bg-gray-800/30 ${r.cd_empresa === selectedEmpresa ? "bg-purple-950/40" : ""}`}>
                    <td className="py-2 px-3 text-white">{getEmpresaLabel(r.cd_empresa)}</td>
                    <td className="py-2 px-3 text-right text-gray-300">{fmtNum(r.qtd)}</td>
                    <td className="py-2 px-3 text-right text-blue-400 font-medium">{fmtCur(r.vl_total)}</td>
                    <td className="py-2 px-3 text-right text-amber-400">{fmtCur(r.vl_aberto)}</td>
                    <td className="py-2 px-3 text-right text-gray-300">{fmtCur(r.vl_baixado)}</td>
                    <td className="py-2 px-3 text-right text-red-400">{fmtCur(r.vl_vencido)}</td>
                  </tr>
                ))}
                {carEmp.length === 0 && <tr><td colSpan={6} className="text-center text-gray-600 py-6">Sem dados de CAR por empresa</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CAP por conta — consulta ao vivo agrupada pelo plano financeiro */}
      {sub === "cap_conta" && <CapPorContaTab dateRange={dateRange} />}

      {/* Balancete */}
      {sub === "balancete" && (() => {
        const isLegacy = balancete.length > 0 && balancete[0].vl_entradas === undefined;
        const totEnt = balancete.reduce((s, r) => s + (r.vl_entradas || 0), 0);
        const totSai = balancete.reduce((s, r) => s + (r.vl_saidas || 0), 0);
        return (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-white font-semibold mb-1 text-sm">Balancete financeiro — movimentação de caixa</h3>
            <p className="text-xs text-gray-500 mb-4">Entradas = recebimentos baixados (CAR) · Saídas = pagamentos baixados (CAP) · pela data da baixa no período</p>
            {isLegacy ? (
              <div className="bg-amber-950/30 border border-amber-800/40 rounded-lg px-4 py-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-amber-300 text-xs">O balancete foi recalculado com nova lógica de movimentação. Clique em "Atualizar dados" para gerar os novos valores.</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 text-xs uppercase border-b border-gray-800">
                      <th className="text-left py-2 px-3">Conta</th>
                      <th className="text-left py-2 px-3">Descrição</th>
                      <th className="text-right py-2 px-3">Entradas</th>
                      <th className="text-right py-2 px-3">Saídas</th>
                      <th className="text-right py-2 px-3">Saldo</th>
                      <th className="text-right py-2 px-3">Lançamentos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {balancete.map((r, i) => (
                      <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                        <td className="py-2 px-3 text-gray-400 font-mono text-xs">{r.nr_planfin}</td>
                        <td className="py-2 px-3 text-white">{r.ds_planfin}</td>
                        <td className="py-2 px-3 text-right text-green-400">{fmtCur(r.vl_entradas)}</td>
                        <td className="py-2 px-3 text-right text-red-400">{fmtCur(r.vl_saidas)}</td>
                        <td className={`py-2 px-3 text-right font-medium ${(r.saldo || 0) >= 0 ? "text-white" : "text-red-400"}`}>{fmtCur(r.saldo)}</td>
                        <td className="py-2 px-3 text-right text-gray-500 text-xs">{fmtNum((r.qtd_entradas || 0) + (r.qtd_saidas || 0))}</td>
                      </tr>
                    ))}
                    {balancete.length === 0 && <tr><td colSpan={6} className="text-center text-gray-600 py-6">Sem dados de balancete</td></tr>}
                  </tbody>
                  {balancete.length > 0 && (
                    <tfoot>
                      <tr className="border-t border-gray-700 bg-gray-800/40 font-semibold">
                        <td className="py-2 px-3 text-white" colSpan={2}>Total</td>
                        <td className="py-2 px-3 text-right text-green-400">{fmtCur(totEnt)}</td>
                        <td className="py-2 px-3 text-right text-red-400">{fmtCur(totSai)}</td>
                        <td className={`py-2 px-3 text-right ${totEnt - totSai >= 0 ? "text-white" : "text-red-400"}`}>{fmtCur(totEnt - totSai)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}