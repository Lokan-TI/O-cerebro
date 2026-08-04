import { useErpAnalytics } from "@/lib/ErpAnalyticsContext";
import { useErpSource } from "@/lib/ErpSourceContext";
import { getEmpresaLabel } from "@/lib/empresaLabels";
import { fmtCur, fmtNum } from "@/lib/erpFormat";
import AnalyticsFilterBar from "@/components/erp/AnalyticsFilterBar";
import { TrendingUp, TrendingDown, Wallet, FileText, Package, Users, AlertTriangle, Calendar } from "lucide-react";
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

function KpiCard({ icon: Icon, label, value, sub, color }) {
  const colors = {
    green: "border-green-700/40 bg-green-950/30 text-green-300",
    red: "border-red-700/40 bg-red-950/30 text-red-300",
    purple: "border-purple-700/40 bg-purple-950/30 text-purple-300",
    amber: "border-amber-700/40 bg-amber-950/30 text-amber-300",
    blue: "border-blue-700/40 bg-blue-950/30 text-blue-300",
    gray: "border-gray-700/40 bg-gray-900/40 text-gray-300",
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color] || colors.gray}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 opacity-70" />
        <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

export default function TabVisaoGeral() {
  const { data, loading, error } = useErpAnalytics();
  const { selectedSource } = useErpSource();

  if (loading) return <div className="text-gray-500 p-8 text-center">Carregando visão geral…</div>;
  if (error) return <div className="text-red-400 p-8 text-center">Erro: {error}</div>;
  if (!data) return <div className="text-gray-500 p-8 text-center">Sem dados.</div>;

  const k = data.kpis || {};
  const dr = data.date_range || {};
  const monthly = data.car_vs_cap_monthly || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm text-gray-400">
          Fonte: <span className="text-white">{selectedSource?.name}</span> · Período: <span className="text-white">{dr.start} → {dr.end}</span>
        </div>
        <AnalyticsFilterBar />
      </div>

      {/* KPI Grid — cross-table overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={Users} label="Pessoas (base)" value={fmtNum(k.pessoa_total)} sub="Total cadastradas" color="gray" />
        <KpiCard icon={TrendingUp} label="CAR (Receber)" value={fmtCur(k.car_total)} sub={`${fmtCur(k.car_aberto)} em aberto`} color="green" />
        <KpiCard icon={TrendingDown} label="CAP (Pagar)" value={fmtCur(k.cap_total)} sub={`${fmtCur(k.cap_aberto)} em aberto`} color="red" />
        <KpiCard icon={Wallet} label="Margem Fluxo" value={fmtCur(k.margem_fluxo)} sub={k.margem_percent != null ? `${k.margem_percent.toFixed(1)}%` : "—"} color={k.margem_fluxo >= 0 ? "green" : "red"} />
        <KpiCard icon={FileText} label="Locações" value={fmtNum(k.fichloc_total)} sub={`${k.fichloc_ativas || 0} ativas · ${k.fichloc_encerradas || 0} encerradas`} color="purple" />
        <KpiCard icon={Package} label="Movimentações" value={fmtNum(k.est_mov_total)} sub="Operações de estoque" color="blue" />
        <KpiCard icon={AlertTriangle} label="CAR Vencido" value={fmtCur(k.car_vencido)} sub="Títulos vencidos" color="amber" />
        <KpiCard icon={AlertTriangle} label="CAP Vencido" value={fmtCur(k.cap_vencido)} sub="Contas vencidas" color="amber" />
      </div>

      {/* Timeline — CAR vs CAP mensal */}
      {monthly.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4 text-sm flex items-center gap-2">
            <Calendar className="w-4 h-4 text-purple-400" /> CAR vs CAP — série mensal (PESSOA × DATA)
          </h3>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222" />
              <XAxis dataKey="label" stroke="#666" fontSize={11} />
              <YAxis stroke="#666" fontSize={11} tickFormatter={(v) => fmtCur(v).replace("R$", "")} />
              <Tooltip contentStyle={{ backgroundColor: "#111", border: "1px solid #333" }} formatter={(v) => fmtCur(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="car" name="CAR (Receber)" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="cap" name="CAP (Pagar)" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Line dataKey="car_baixado" name="CAR Baixado" stroke="#86efac" strokeWidth={2} dot={false} />
              <Line dataKey="cap_baixado" name="CAP Baixado" stroke="#fca5a5" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Resumo por empresa — all tables */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-white font-semibold mb-4 text-sm">Resumo por empresa</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs uppercase border-b border-gray-800">
                <th className="text-left py-2 px-3">Empresa</th>
                <th className="text-right py-2 px-3">CAR Total</th>
                <th className="text-right py-2 px-3">CAP Total</th>
                <th className="text-right py-2 px-3">Locações</th>
                <th className="text-right py-2 px-3">Moviment.</th>
              </tr>
            </thead>
            <tbody>
              {(data.empresas || []).map((emp, i) => {
                const car = (data.car_by_empresa || []).find(r => r.cd_empresa === emp.cd_empresa);
                const cap = (data.cap_by_empresa || []).find(r => r.cd_empresa === emp.cd_empresa);
                const fich = (data.fichloc_by_empresa || []).find(r => r.cd_empresa === emp.cd_empresa);
                return (
                  <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="py-2 px-3 text-white">{getEmpresaLabel(emp.cd_empresa)}</td>
                    <td className="py-2 px-3 text-right text-green-400">{fmtCur(car?.vl_total || 0)}</td>
                    <td className="py-2 px-3 text-right text-red-400">{fmtCur(cap?.vl_total || 0)}</td>
                    <td className="py-2 px-3 text-right text-purple-400">{fmtNum(fich?.qtd || 0)}</td>
                    <td className="py-2 px-3 text-right text-blue-400">{fmtNum(0)}</td>
                  </tr>
                );
              })}
              {(data.empresas || []).length === 0 && (
                <tr><td colSpan={5} className="text-center text-gray-600 py-6">Sem dados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {data.errors?.length > 0 && (
        <div className="bg-red-950/30 border border-red-800/40 rounded-xl p-4">
          <div className="text-red-300 text-xs font-semibold mb-2">Avisos de consulta ({data.errors.length})</div>
          <ul className="text-xs text-red-400/70 space-y-1">
            {data.errors.slice(0, 5).map((e, i) => <li key={i}>• {e}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}