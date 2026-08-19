import { Users, UserCheck, UserX, DollarSign, Percent, Clock, Wallet, AlertTriangle } from "lucide-react";

const brl = (v) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const int = (v) => (Number(v) || 0).toLocaleString("pt-BR");
const pct = (v) => `${(Number(v) || 0).toFixed(1)}%`;

function Card({ icon: Icon, label, value, tone = "text-white" }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center gap-2 text-gray-400 text-xs uppercase tracking-wide">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <p className={`text-2xl font-bold mt-1 ${tone}`}>{value}</p>
    </div>
  );
}

export default function Cliente360Kpis({ k }) {
  if (!k) return null;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Card icon={Users} label="Clientes na base" value={int(k.clientes_total)} />
      <Card icon={UserCheck} label="Ativos (90 dias)" value={int(k.clientes_ativos)} tone="text-green-400" />
      <Card icon={UserX} label="Em churn (>1 ano)" value={int(k.clientes_churn)} tone="text-red-400" />
      <Card icon={DollarSign} label="Faturamento total" value={brl(k.faturamento_total)} />
      <Card icon={DollarSign} label="Ticket médio / cliente" value={brl(k.ticket_medio_cliente)} />
      <Card icon={Percent} label="Concentração top 10" value={pct(k.concentracao_top10)} tone="text-purple-400" />
      <Card icon={Wallet} label="CAR liquidado" value={brl(k.car_liquidado_total)} tone="text-green-400" />
      <Card icon={Wallet} label="CAR em aberto" value={brl(k.car_aberto_total)} tone="text-purple-300" />
      <Card icon={AlertTriangle} label="CAR vencido" value={brl(k.car_vencido_total)} tone="text-amber-400" />
      <Card icon={Wallet} label="CAR provisório" value={brl(k.car_provisorio_total)} tone="text-gray-400" />
      <Card icon={DollarSign} label="Juros/multa recebidos" value={brl(k.car_juros_multa_total)} tone="text-amber-300" />
      <Card icon={Clock} label="Recência média" value={`${Math.round(Number(k.recencia_media) || 0)} dias`} />
      <Card icon={Users} label="Clientes com faturamento" value={int(k.clientes_com_faturamento)} />
    </div>
  );
}