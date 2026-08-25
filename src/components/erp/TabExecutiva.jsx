import { useErpSnapshot } from "@/lib/ErpSnapshotContext";
import AnnualGrowthChart from "@/components/erp/AnnualGrowthChart";
import ChurnMetricPanel from "@/components/erp/ChurnMetricPanel";
import ChurnEmpresaRanking from "@/components/erp/ChurnEmpresaRanking";
import { useEmpresaFilter } from "@/lib/EmpresaFilterContext";
import { useGlobalFilter } from "@/lib/GlobalFilterContext";
import { scopeByPeriod } from "@/lib/periodScope";
import { getEmpresaLabel, compareEmpresa } from "@/lib/empresaLabels";
import { fmtCur, fmtNum } from "@/lib/erpFormat";
import {
  TrendingUp, TrendingDown, Users, UserPlus, UserMinus, Repeat, Wallet,
  FileText, AlertTriangle, Calendar, Crown, Percent, Award,
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
  const { selectedEmpresa, empresaList, setSelectedEmpresa } = useEmpresaFilter();
  const { period } = useGlobalFilter();

  if (loading) return <div className="text-gray-500 p-8 text-center">Carregando visão executiva…</div>;
  if (!snapshot) return (
    <div className="text-gray-500 p-8 text-center">
      Sem snapshot disponível. Toque em <span className="text-purple-400">Atualizar dados</span> para carregar.
    </div>
  );

  const byEmp = [...(snapshot.by_empresa || [])].sort((a, b) => compareEmpresa(a.cd_empresa, b.cd_empresa));
  const k = snapshot.kpis || {};
  const isAll = selectedEmpresa == null;
  const empRow = !isAll ? byEmp.find((e) => e.cd_empresa === selectedEmpresa) : null;

  // Receita, ticket e crescimento são recalculados na janela do filtro global
  // (com a janela anterior de mesma duração como comparação). Sem série mensal
  // no período, cai para os valores do ano civil do snapshot.
  const ps = scopeByPeriod(snapshot, period, selectedEmpresa);
  const receita = ps.hasData ? ps.receita : isAll ? k.fat_ano : empRow?.fat_ano || 0;
  const receitaAnt = ps.hasData ? ps.receitaAnt : isAll ? k.fat_ano_ant : empRow?.fat_ano_ant || 0;
  const crescimento = ps.hasData ? ps.crescimento : isAll ? k.crescimento_ano : empRow?.crescimento_ano ?? null;
  const ticket = ps.hasData ? ps.ticket : isAll ? k.ticket_ano : empRow?.ticket_ano || 0;
  const clientes = isAll ? k.clientes_ano : empRow?.clientes_ano || 0;
  const clientesMes = isAll ? k.clientes_mes : empRow?.clientes_mes || 0;
  const receitaPorCliente = isAll ? k.receita_por_cliente : empRow?.receita_por_cliente || 0;

  // Churn 12 meses: consolidado do grupo ou da filial selecionada
  const churn12Scoped = isAll
    ? k.churn12
    : (k.churn12_by_empresa || []).find((r) => r.cd_empresa === selectedEmpresa) || null;

  // Retenção/churn: consolidado ou por empresa (armazenado em by_empresa)
  const retencao = isAll ? k.retention_rate : empRow?.retention_rate ?? null;
  const churn = isAll ? k.churn_rate : empRow?.churn_rate ?? null;
  const churnedClients = isAll ? k.churned_clients : empRow?.churned_clients ?? null;
  const newClients = isAll ? k.new_clients : empRow?.new_clients ?? null;
  const retainedClients = isAll ? k.retained_clients : empRow?.retained_clients ?? null;
  const newRevenue = isAll ? k.new_client_revenue : empRow?.new_client_revenue ?? null;
  const retainedRevenue = isAll ? k.retained_revenue : empRow?.retained_revenue ?? null;

  const MONTHS = ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const allMonthly = snapshot.monthly_revenue || [];
  const monthlyBase = isAll
    ? Object.values(allMonthly.reduce((acc, r) => {
        const k = `${r.ano}-${r.mes}`;
        acc[k] = acc[k] || { ano: r.ano, mes: r.mes, valor: 0, nfs: 0, clientes: 0 };
        acc[k].valor += Number(r.valor) || 0;
        acc[k].nfs += Number(r.nfs) || 0;
        acc[k].clientes += Number(r.clientes) || 0;
        return acc;
      }, {})).sort((a, b) => a.ano - b.ano || a.mes - b.mes)
    : allMonthly.filter((r) => Number(r.cd_empresa) === selectedEmpresa);
  const monthlyRaw = ps.hasData ? ps.monthly : monthlyBase;
  const monthly = monthlyRaw.map((r) => ({
    label: `${MONTHS[r.mes] || r.mes}/${String(r.ano).slice(2)}`,
    valor: r.valor,
    nfs: r.nfs,
  }));
  const topClients = isAll
    ? (snapshot.top_clients || []).slice(0, 15)
    : (snapshot.top_clients_by_empresa || []).filter((c) => Number(c.cd_empresa) === selectedEmpresa).slice(0, 15);
  const topVendors = isAll
    ? (snapshot.top_vendors || []).slice(0, 15)
    : (snapshot.top_vendors_by_empresa || []).filter((v) => Number(v.cd_empresa) === selectedEmpresa).slice(0, 15);
  const alerts = snapshot.alerts || [];

  const fmtPct = (v) => (v == null ? "—" : `${v.toFixed(1)}%`);

  // Fonte única de verdade para churn/retenção: janela móvel de 12 meses (churn12_by_empresa).
  // O comparativo abaixo usava a coorte do ano civil, gerando números diferentes da tabela de churn.
  const churn12Map = new Map((k.churn12_by_empresa || []).map((r) => [r.cd_empresa, r]));
  const cresColor = crescimento == null ? "gray" : crescimento >= 0 ? "green" : "red";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm text-gray-400">
          Empresa:{" "}
          <span className="text-white font-medium">
            {isAll ? "Todas (consolidado)" : getEmpresaLabel(selectedEmpresa, empRow?.nm_empresa)}
          </span>
          {" · "}Período analisado:{" "}
          <span className="text-white font-medium">{period.start} → {period.end}</span>
          {" · "}Base do snapshot: até {snapshot.max_date || "—"}
        </div>
      </div>

      {ps.hasData && ps.monthly.length < ps.months && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-800 bg-amber-900/20 px-4 py-2.5 text-amber-300 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          O snapshot atual guarda {ps.monthly.length} de {ps.months} meses do período selecionado. Use “Atualizar dados”
          para recarregar a série completa do ERP.
        </div>
      )}

      {/* Faturamento NF */}
      <div>
        <h3 className="text-purple-300 text-xs font-semibold uppercase tracking-wider mb-3">Faturamento NF</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard icon={TrendingUp} label="Faturamento NF do período" value={fmtCur(receita)} sub={`Período anterior: ${fmtCur(receitaAnt)}`} color="green" />
          <KpiCard icon={Percent} label="Crescimento" value={fmtPct(crescimento)} sub={ps.hasData ? `vs. ${ps.months} meses anteriores` : "vs. período anterior"} color={cresColor} />
          <KpiCard icon={FileText} label="Ticket médio" value={fmtCur(ticket)} sub={ps.hasData ? `${fmtNum(ps.nfs)} notas no período` : "Por nota fiscal"} color="blue" />
          <KpiCard icon={Wallet} label="Faturamento por cliente" value={fmtCur(receitaPorCliente)} sub={`${fmtNum(clientes)} clientes`} color="purple" />
        </div>
      </div>

      {/* Clientes */}
      <div>
        <h3 className="text-purple-300 text-xs font-semibold uppercase tracking-wider mb-3">Clientes</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard icon={Users} label="Clientes ativos (ano)" value={fmtNum(clientes)} sub={`${fmtNum(clientesMes)} no mês`} color="purple" />
          <KpiCard icon={UserPlus} label="Novos clientes" value={fmtNum(newClients)} sub="Primeira compra no ano" color="green" />
          <KpiCard icon={Repeat} label="Recorrentes" value={fmtNum(retainedClients)} sub="Compraram ano anterior e atual" color="blue" />
          <KpiCard icon={UserMinus} label="Em churn (12 meses)" value={churn12Scoped ? fmtNum(churn12Scoped.churned_clients) : "—"} sub={isAll ? "Sem faturar nos últimos 12 meses" : "Da filial selecionada — igual à tabela abaixo"} color="red" />
        </div>
      </div>

      {/* Retenção */}
      <div>
        <h3 className="text-purple-300 text-xs font-semibold uppercase tracking-wider mb-3">
          Retenção & Churn — janela móvel de 12 meses{" "}
          <span className="text-gray-500 normal-case">
            · {isAll ? "consolidado do grupo" : getEmpresaLabel(selectedEmpresa, empRow?.nm_empresa)}
          </span>
        </h3>
        <ChurnMetricPanel churn12={churn12Scoped} calendarChurn={isAll ? k.churn_rate : empRow?.churn_rate} />
      </div>

      {/* Ranking de filiais por retenção — sempre visível para comparação */}
      <div>
        <h3 className="text-purple-300 text-xs font-semibold uppercase tracking-wider mb-3">
          Churn por empresa — qual filial retém mais clientes
        </h3>
        <ChurnEmpresaRanking
          rows={k.churn12_by_empresa}
          selectedEmpresa={selectedEmpresa}
          onSelectEmpresa={(cd) => setSelectedEmpresa(cd === selectedEmpresa ? null : cd)}
        />
      </div>

      {/* Coorte por ano civil — leitura complementar */}
      <div>
        <h3 className="text-purple-300 text-xs font-semibold uppercase tracking-wider mb-3">
          Coorte do ano civil (complementar){" "}
          <span className="text-gray-500 normal-case">
            · {isAll ? "consolidado do grupo" : getEmpresaLabel(selectedEmpresa, empRow?.nm_empresa)} · janela diferente da tabela de 12 meses
          </span>
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard icon={Repeat} label="Retenção no ano" value={fmtPct(retencao)} sub={`${fmtNum(retainedClients)} recorrentes de quem faturou no ano anterior`} color="green" />
          <KpiCard icon={UserMinus} label="Churn no ano" value={fmtPct(churn)} sub={`${fmtNum(churnedClients)} sem faturar neste ano civil`} color="red" />
          <KpiCard icon={TrendingUp} label="Receita de novos" value={fmtCur(newRevenue)} sub={`${fmtNum(newClients)} clientes de primeira compra no ano`} color="green" />
          <KpiCard icon={TrendingDown} label="Receita retida" value={fmtCur(retainedRevenue)} sub="De clientes recorrentes no ano civil" color="amber" />
        </div>
        <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">
          Leitura por ano civil (compara quem faturou no ano anterior com quem faturou neste ano, ainda incompleto) —
          por isso os percentuais divergem da janela móvel de 12 meses acima. O indicador oficial de churn e retenção é
          o de 12 meses; este bloco serve apenas de contexto de sazonalidade.
        </p>
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
                <th className="text-right py-2 px-3">Faturamento NF (período)</th>
                <th className="text-right py-2 px-3">Crescimento</th>
                <th className="text-right py-2 px-3">Clientes (ano)</th>
                <th className="text-right py-2 px-3">Churn 12m</th>
                <th className="text-right py-2 px-3">Retenção 12m</th>
                <th className="text-right py-2 px-3">Ticket médio</th>
                <th className="text-right py-2 px-3">Receita/cliente</th>
              </tr>
            </thead>
            <tbody>
              {byEmp.map((e) => {
                const active = e.cd_empresa === selectedEmpresa;
                const pe = ps.hasData ? ps.byEmpresa.get(Number(e.cd_empresa)) : null;
                const fat = pe ? pe.receita : e.fat_ano;
                const cres = pe ? pe.crescimento : e.crescimento_ano;
                const tkt = pe ? pe.ticket : e.ticket_ano;
                const c12 = churn12Map.get(e.cd_empresa);
                const churnRate = c12?.base_clients > 0 ? c12.churn_rate : null;
                const retRate = c12?.base_clients > 0 ? c12.retention_rate : null;
                return (
                  <tr key={e.cd_empresa} className={`border-b border-gray-800/50 hover:bg-gray-800/30 ${active ? "bg-purple-950/40" : ""}`}>
                    <td className="py-2 px-3 text-white font-medium">{getEmpresaLabel(e.cd_empresa, e.nm_empresa)}</td>
                    <td className="py-2 px-3 text-right text-green-400">{fmtCur(fat)}</td>
                    <td className={`py-2 px-3 text-right ${cres == null ? "text-gray-500" : cres >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {cres == null ? "—" : `${cres.toFixed(1)}%`}
                    </td>
                    <td className="py-2 px-3 text-right text-purple-400">{fmtNum(e.clientes_ano)}</td>
                    <td className={`py-2 px-3 text-right ${churnRate == null ? "text-gray-500" : churnRate >= 30 ? "text-red-400" : churnRate >= 15 ? "text-amber-400" : "text-green-400"}`}>
                      {fmtPct(churnRate)}
                      {churnRate != null && <span className="text-gray-600 text-xs ml-1">({fmtNum(c12.churned_clients)})</span>}
                    </td>
                    <td className={`py-2 px-3 text-right ${retRate == null ? "text-gray-500" : "text-green-400"}`}>{fmtPct(retRate)}</td>
                    <td className="py-2 px-3 text-right text-blue-400">{fmtCur(tkt)}</td>
                    <td className="py-2 px-3 text-right text-gray-300">{fmtCur(e.receita_por_cliente)}</td>
                  </tr>
                );
              })}
              {byEmp.length === 0 && (
                <tr><td colSpan={8} className="text-center text-gray-600 py-6">Sem dados por empresa</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-gray-500 mt-3 leading-relaxed">
          Faturamento NF, crescimento e ticket seguem o período do filtro ({period.start} → {period.end}), comparados com a
          janela anterior de mesma duração. Clientes são do ano civil do snapshot. Churn e retenção usam
          a janela móvel de 12 meses — os mesmos números da tabela "Churn por empresa" acima, para não haver duas
          leituras diferentes do mesmo indicador. Filiais sem base nos 12 meses anteriores aparecem com "—".
        </p>
      </div>

      {/* Evolução anual de crescimento */}
      <AnnualGrowthChart />

      {/* Série mensal + Top clientes/vendedores — consolidado ou por empresa */}
      <div className="space-y-6">
          {monthly.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="text-white font-semibold mb-4 text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4 text-purple-400" /> Receita mensal · {period.start} → {period.end}
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {topClients.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h3 className="text-white font-semibold mb-4 text-sm flex items-center gap-2">
                  <Crown className="w-4 h-4 text-purple-400" /> Top 15 clientes (receita)
                </h3>
                <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
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
                          <td className="py-1.5 px-2 text-gray-300 truncate max-w-[180px]">{c.nm_pessoa || `Cliente ${c.cd_pessoa}`}</td>
                          <td className="py-1.5 px-2 text-right text-green-400">{fmtCur(c.total)}</td>
                          <td className="py-1.5 px-2 text-right text-gray-400">{fmtNum(c.nfs)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {topVendors.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h3 className="text-white font-semibold mb-4 text-sm flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-400" /> Top 15 vendedores (base de comissão)
                </h3>
                <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-gray-900">
                      <tr className="text-gray-500 text-xs uppercase border-b border-gray-800">
                        <th className="text-left py-2 px-2">#</th>
                        <th className="text-left py-2 px-2">Vendedor</th>
                        <th className="text-right py-2 px-2">Base comissão</th>
                        <th className="text-right py-2 px-2">Notas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topVendors.map((v, i) => (
                        <tr key={i} className="border-b border-gray-800/50">
                          <td className="py-1.5 px-2 text-gray-500">{i + 1}</td>
                          <td className="py-1.5 px-2 text-gray-300 truncate max-w-[180px]">{v.nm_pessoa || `Vendedor ${v.cd_pessoa_fun}`}</td>
                          <td className="py-1.5 px-2 text-right text-amber-400">{fmtCur(v.total)}</td>
                          <td className="py-1.5 px-2 text-right text-gray-400">{fmtNum(v.nfs)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

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