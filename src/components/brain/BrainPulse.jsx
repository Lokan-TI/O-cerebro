import { Link } from "react-router-dom";
import { fmtCur, fmtNum } from "@/lib/erpFormat";
import { TrendingUp, Users, UserMinus, AlertTriangle, ArrowRight, Database, BarChart3, UserPlus } from "lucide-react";

function Pulse({ icon: Icon, label, value, sub, tone }) {
  const tones = {
    green: "text-green-400 border-green-800/40",
    red: "text-red-400 border-red-800/40",
    purple: "text-purple-400 border-purple-800/40",
    amber: "text-amber-400 border-amber-800/40",
  };
  return (
    <div className={`bg-gray-900/60 backdrop-blur border ${tones[tone] || "border-gray-800"} rounded-xl p-4`}>
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className={`w-3.5 h-3.5 ${tones[tone]?.split(" ")[0] || "text-gray-400"}`} />
        <span className="text-[11px] text-gray-500 uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-xl font-bold text-white">{value}</div>
      {sub && <div className="text-[11px] text-gray-500 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function BrainPulse({ snapshot }) {
  const k = snapshot?.kpis || {};
  const alerts = snapshot?.alerts || [];

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      {/* Pulso do negócio */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Pulse icon={TrendingUp} label="Faturamento NF do período" value={fmtCur(k.fat_ano)} sub={k.crescimento_ano != null ? `${k.crescimento_ano > 0 ? "+" : ""}${Number(k.crescimento_ano).toFixed(1)}% vs anterior` : null} tone="green" />
        <Pulse icon={Users} label="Clientes ativos" value={fmtNum(k.clientes_ano)} sub={k.new_clients != null ? `${fmtNum(k.new_clients)} novos no ano` : null} tone="purple" />
        <Pulse icon={UserMinus} label="Churn" value={k.churn_rate != null ? `${Number(k.churn_rate).toFixed(1)}%` : "—"} sub={k.retention_rate != null ? `retenção ${Number(k.retention_rate).toFixed(1)}%` : null} tone="red" />
        <Pulse icon={AlertTriangle} label="Alertas ativos" value={fmtNum(alerts.length)} sub={alerts[0]?.title || alerts[0]?.message || null} tone="amber" />
      </div>

      {/* Atalhos */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { to: "/ErpCrmDashboard", icon: BarChart3, title: "Dashboard ERP", desc: "KPIs, financeiro, churn e clientes" },
          { to: "/ConversaoNovosClientes", icon: UserPlus, title: "Conversão de Novos Clientes", desc: "Cadastro → locação → nota fiscal" },
          { to: "/GerenciarFontes", icon: Database, title: "Fontes de Dados", desc: "Conexões e atualização das bases" },
        ].map((s) => (
          <Link key={s.to} to={s.to} className="group bg-gray-900/60 backdrop-blur border border-gray-800 hover:border-purple-600/50 rounded-xl p-4 transition-colors">
            <div className="flex items-center justify-between mb-1.5">
              <s.icon className="w-4 h-4 text-purple-400" />
              <ArrowRight className="w-3.5 h-3.5 text-gray-600 group-hover:text-purple-400 group-hover:translate-x-0.5 transition-all" />
            </div>
            <div className="text-white text-sm font-semibold">{s.title}</div>
            <div className="text-gray-500 text-xs mt-0.5">{s.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}