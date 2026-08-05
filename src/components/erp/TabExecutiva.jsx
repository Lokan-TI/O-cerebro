import { useErpSnapshot } from "@/lib/ErpSnapshotContext";
import { useEmpresaFilter } from "@/lib/EmpresaFilterContext";
import { getEmpresaLabel } from "@/lib/empresaLabels";
import { fmtCur, fmtNum } from "@/lib/erpFormat";
import {
  TrendingUp, TrendingDown, Users, UserPlus, UserMinus, Repeat, Wallet,
  FileText, AlertTriangle, Calendar, Crown, Percent,
} from "lucide-react";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from "recharts";

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

export default function TabExecutiva() {
  const { snapshot, loading } = useErpSnapshot();
  const { selectedEmpresa, empresaList } = useEmpresaFilter();

  if (loading) return <div className="text-gray-500 p-8 text-center">Carregando visão executiva…</div>;
  if (!snapshot) return (
    <div className="text-gray-500 p-8 text-center">
      Sem snapshot disponível. Toque em <span className="text-purple-400">Atualizar dados</span> para carregar.
    </div>
  );

  const byEmp = snapshot.by_empresa || [];
  const k = snapshot.kpis || {};
  const isAll = selectedEmpresa == null;
  const empRow = !isAll ? byEmp.find((e) => e.cd_empresa === selectedEmpresa) : null;

  const receita = isAll ? k.fat_ano : empRow?.fat_ano || 0;
  const receitaAnt = isAll ? k.fat_ano_ant : empRow?.fat_ano_ant || 0;
  const crescimento = isAll ? k.crescimento_ano : empRow?.crescimento_ano ?? null;
  const ticket = isAll ? k.ticket_ano : empRow?.ticket_ano || 0;
  const clientes = isAll ? k.clientes_ano : empRow?.clientes_ano || 0;
  const clientesMes = isAll ? k.clientes_mes : empRow?.clientes_mes || 0;
  const receitaPorCliente = isAll ? k.receita_por_cliente : empRow?.receita_por_cliente || 0;

  // Retenção/churn só existem consolidados no snapshot
  const retencao = isAll ? k.retention_rate : null;
  const churn = isAll ? k.churn_rate : null;
  const churnedClients = isAll ? k.churned_clients : null;
  const newClients = isAll ? k.new_clients : null;
  const retainedClients = isAll ? k.retained_clients : null;
  const newRevenue = isAll ? k.new_client_revenue : null;
  const retainedRevenue = isAll ? k.retained_revenue : null;

  const monthly = (snapshot.monthly_revenue || []).map((r) => ({
    label: `${["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][r.mes] || r.mes}/${String(r.ano).slice(2)}`,
    valor: r.valor,
    nfs: r.nfs,
  }));
  const topClients = (snapshot.top_clients || []).slice(0, 15);
  const alerts = snapshot.alerts || [];

  const fmtPct = (v) => (v == null ? "—" : `${v.toFixed(1)}%`);
  const cresColor = crescimento == null ? "gray" : crescimento >= 0 ? "green" : "red";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm text-gray-400">
          Empresa:{" "}
          <span className="text-white font-medium">
            {isAll ? "Todas (consolidado)" : getEmpresaLabel(selectedEmpresa, empRow?.nm_empresa)}
          </span>
          {" · "}Período dos dados: até {snapshot.max_date || "—"}
        </div>
      </div>

      {/* Receita */}
      <div>
        <h3 className="text-purple-300 text-xs font-semibold uppercase tracking-wider mb-3">Receita</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard icon={TrendingUp} label="Receita do período" value={fmtCur(receita)} sub={`Ano anterior: ${fmtCur(receitaAnt)}`} color="green" />
          <KpiCard icon={Percent} label="Crescimento" value={fmtPct(crescimento)} sub="vs. período anterior" color={cresColor} />
          <KpiCard icon={FileText} label="Ticket médio" value={fmtCur(ticket)} sub="Por nota fiscal" color="blue" />
          <KpiCard icon={Wallet} label="Receita por cliente" value={fmtCur(receitaPorCliente)} sub={`${fmtNum(clientes)} clientes`} color="purple" />
        </div>
      </div>

      {/* Clientes */}
      <div>
        <h3 className="text-purple-300 text-xs font-semibold uppercase tracking-wider mb-3">Clientes</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard icon={Users} label="Clientes ativos (ano)" value={fmtNum(clientes)} sub={`${fmtNum(clientesMes)} no mês`} color="purple" />
          <KpiCard icon={UserPlus} label="Novos clientes" value={isAll ? fmtNum(newClients) : "—"} sub="Primeira compra no ano" color="green" />
          <KpiCard icon={Repeat} label="Recorrentes" value={isAll ? fmtNum(retainedClients) : "—"} sub="Compraram ano anterior e atual" color="blue" />
          <KpiCard icon={UserMinus} label="Em churn" value={isAll ? fmtNum(churnedClients) : "—"} sub="Pararam de comprar" color="red" />
        </div>
      </div>

      {/* Retenção */}
      <div>
        <h3 className="text-purple-300 text-xs font-semibold uppercase tracking-wider mb-3">Retenção & Churn</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard icon={Repeat} label="Taxa de retenção" value={fmtPct(retencao)} sub={isAll ? "Consolidado" : "Por empresa: indisponível"} color="green" />
          <KpiCard icon={UserMinus} label="Churn de clientes" value={fmtPct(churn)} sub={isAll ? "Consolidado" : "Por empresa: indisponível"} color="red" />
          <KpiCard icon={TrendingUp} label="Receita de novos" value={isAll ? fmtCur(newRevenue) : "—"} sub="Trazida por novos clientes" color="green" />
          <KpiCard icon={TrendingDown} label="Receita retida" value={isAll ? fmtCur(retainedRevenue) : "—"} sub="De clientes recorrentes" color="amber" />
        </div>
      </div>

      {/* Comparativo por empresa */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-white font-semibold mb-4 text-sm flex items-center gap-2">
          <Crown className="w-4 h-4 text-purple-400" /> Comparativo por empresa
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs uppercase border-b border-gray-800">
                <th className="text-left py-2 px-3">Empresa</th>
                <th className="text-right py-2 px-3">Receita</th>
                <th className="text-right py-2 px-3">Crescimento</th>
                <th className="text-right py-2 px-3">Clientes</th>
                <th className="text-right py-2 px-3">Ticket médio</th>
                <th className="text-right py-2 px-3">Receita/cliente</th>
              </tr>
            </thead>
            <tbody>
              {byEmp.map((e) => {
                const active = e.cd_empresa === selectedEmpresa;
                return (
                  <tr key={e.cd_empresa} className={`border-b border-gray-800/50 hover:bg-gray-800/30 ${active ? "bg-purple-950/40" : ""}`}>
                    <td className="py-2 px-3 text-white font-medium">{getEmpresaLabel(e.cd_empresa, e.nm_empresa)}</td>
                    <td className="py-2 px-3 text-right text-green-400">{fmtCur(e.fat_ano)}</td>
                    <td className={`py-2 px-3 text-right ${e.crescimento_ano == null ? "text-gray-500" : e.crescimento_ano >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {e.crescimento_ano == null ? "—" : `${e.crescimento_ano.toFixed(1)}%`}
                    </td>
                    <td className="py-2 px-3 text-right text-purple-400">{fmtNum(e.clientes_ano)}</td>
                    <td className="py-2 px-3 text-right text-blue-400">{fmtCur(e.ticket_ano)}</td>
                    <td className="py-2 px-3 text-right text-gray-300">{fmtCur(e.receita_por_cliente)}</td>
                  </tr>
                );
              })}
              {byEmp.length === 0 && (
                <tr><td colSpan={6} className="text-center text-gray-600 py-6">Sem dados por empresa</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Série mensal + Top clientes — apenas consolidado */}
      {isAll && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {monthly.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="text-white font-semibold mb-4 text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4 text-purple-400" /> Receita mensal (12 meses)
              </h3>
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                  <XAxis dataKey="label" stroke="#666" fontSize={11} />
                  <YAxis stroke="#666" fontSize={11} tickFormatter={(v) => fmtCur(v).replace("R$", "")} />
                  <Tooltip contentStyle={{ backgroundColor: "#111", border: "1px solid #333" }} formatter={(v) => fmtCur(v)} />
                  <Bar dataKey="valor" name="Receita" fill="#a855f7" radius={[4, 4, 0, 0]} />
                  <Line dataKey="nfs" name="Notas" stroke="#22d3ee" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
          {topClients.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="text-white font-semibold mb-4 text-sm">Top 15 clientes (receita)</h3>
              <div className="overflow-x-auto max-h-[280px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-900">
                    <tr className="text-gray-500 text-xs uppercase border-b border-gray-800">
                      <th className="text-left py-2 px-2">#</th>
                      <th className="text-left py-2 px-2">Cliente</th>
                      <th className="text-right py-2 px-2">Receita</th>
                      <th className="text-right py-2 px-2">Notas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topClients.map((c, i) => (
                      <tr key={i} className="border-b border-gray-800/50">
                        <td className="py-1.5 px-2 text-gray-500">{i + 1}</td>
                        <td className="py-1.5 px-2 text-gray-300 truncate max-w-[180px]">{getEmpresaLabel(c.cd_pessoa) !== `Empresa ${c.cd_pessoa}` ? getEmpresaLabel(c.cd_pessoa) : `Cliente ${c.cd_pessoa}`}</td>
                        <td className="py-1.5 px-2 text-right text-green-400">{fmtCur(c.total)}</td>
                        <td className="py-1.5 px-2 text-right text-gray-400">{fmtNum(c.nfs)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Alertas */}
      {isAll && alerts.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-3 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" /> Alertas automáticos
          </h3>
          <div className="space-y-2">
            {alerts.slice(0, 6).map((a, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${a.severity === "critical" ? "bg-red-500" : a.severity === "warning" ? "bg-amber-500" : "bg-blue-500"}`} />
                <div>
                  <div className="text-white font-medium">{a.title}</div>
                  <div className="text-gray-500 text-xs">{a.message}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}