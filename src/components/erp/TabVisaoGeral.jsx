import { useErpAnalytics } from "@/lib/ErpAnalyticsContext";
import { useErpSource } from "@/lib/ErpSourceContext";
import { getEmpresaLabel } from "@/lib/empresaLabels";
import { TrendingUp, TrendingDown, Wallet, FileText, Package, Users, AlertTriangle, DollarSign } from "lucide-react";

function KpiCard({ icon: Icon, label, value, sub, color }) {
  const colors = {
    blue: "border-blue-700/40 bg-blue-950/30 text-blue-300",
    green: "border-green-700/40 bg-green-950/30 text-green-300",
    red: "border-red-700/40 bg-red-950/30 text-red-300",
    purple: "border-purple-700/40 bg-purple-950/30 text-purple-300",
    amber: "border-amber-700/40 bg-amber-950/30 text-amber-300",
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

function fmtCur(v) {
  if (v == null || isNaN(v)) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}
function fmtNum(v) {
  if (v == null || isNaN(v)) return "—";
  return new Intl.NumberFormat("pt-BR").format(v);
}

export default function TabVisaoGeral() {
  const { data, loading, error, year } = useErpAnalytics();
  const { selectedSource } = useErpSource();

  if (loading) return <div className="text-gray-500 p-8 text-center">Carregando analytics de {year}…</div>;
  if (error) return <div className="text-red-400 p-8 text-center">Erro: {error}</div>;
  if (!data) return <div className="text-gray-500 p-8 text-center">Sem dados.</div>;

  const k = data.kpis || {};

  return (
    <div className="space-y-6">
      <div className="text-sm text-gray-400">
        Fonte: <span className="text-white">{selectedSource?.name}</span> · Ano: <span className="text-white">{year}</span>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={TrendingUp} label="CAR (Receber)" value={fmtCur(k.car_total)} sub={`${fmtNum(k.car_total ? data.car_by_empresa.length : 0)} empresas`} color="green" />
        <KpiCard icon={TrendingDown} label="CAP (Pagar)" value={fmtCur(k.cap_total)} sub={`${fmtNum(k.cap_total ? data.cap_by_conta.length : 0)} contas`} color="red" />
        <KpiCard icon={Wallet} label="Margem Fluxo" value={fmtCur(k.margem_fluxo)} sub={k.margem_percent != null ? `${k.margem_percent.toFixed(1)}%` : "—"} color={k.margem_fluxo >= 0 ? "green" : "red"} />
        <KpiCard icon={AlertTriangle} label="CAR Vencido" value={fmtCur(k.car_vencido)} sub="Títulos vencidos em aberto" color="amber" />
        <KpiCard icon={FileText} label="Locações" value={fmtNum(k.fichloc_total)} sub={`${k.fichloc_ativas || 0} ativas · ${k.fichloc_encerradas || 0} encerradas`} color="purple" />
        <KpiCard icon={Package} label="Movimentações" value={fmtNum(k.est_mov_total)} sub="Operações de estoque" color="blue" />
        <KpiCard icon={DollarSign} label="CAR Baixado" value={fmtCur(k.car_baixado)} sub="Recebido no período" color="green" />
        <KpiCard icon={Users} label="Top Clientes" value={fmtNum(k.top_clients_count)} sub="Maiores devedores" color="gray" />
      </div>

      {/* CAR por empresa */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-white font-semibold mb-4 text-sm">CAR por empresa (Contas a Receber)</h3>
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
              {(data.car_by_empresa || []).map((r, i) => (
                <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="py-2 px-3 text-white">{getEmpresaLabel(r.cd_empresa)}</td>
                  <td className="py-2 px-3 text-right text-gray-300">{fmtNum(r.qtd)}</td>
                  <td className="py-2 px-3 text-right text-green-400 font-medium">{fmtCur(r.vl_total)}</td>
                  <td className="py-2 px-3 text-right text-amber-400">{fmtCur(r.vl_aberto)}</td>
                  <td className="py-2 px-3 text-right text-gray-300">{fmtCur(r.vl_baixado)}</td>
                  <td className="py-2 px-3 text-right text-red-400">{fmtCur(r.vl_vencido)}</td>
                </tr>
              ))}
              {(data.car_by_empresa || []).length === 0 && (
                <tr><td colSpan={6} className="text-center text-gray-600 py-6">Sem dados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Errors */}
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