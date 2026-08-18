import { fmtCur } from "@/lib/erpFormat";
import { TrendingDown, Hammer, ArrowLeftRight, HelpCircle, Wallet, PiggyBank } from "lucide-react";

const Card = ({ icon: Icon, label, value, hint, tone }) => {
  const tones = {
    verde: "border-emerald-700/50 bg-emerald-950/20",
    vermelho: "border-red-700/50 bg-red-950/20",
    azul: "border-blue-700/50 bg-blue-950/20",
    ambar: "border-amber-700/50 bg-amber-950/20",
    cinza: "border-gray-800 bg-gray-900/50",
  };
  return (
    <div className={`border rounded-xl p-4 ${tones[tone] || tones.cinza}`}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-400">
        <Icon className="w-4 h-4" /> {label}
      </div>
      <div className="text-lg xl:text-xl font-bold text-white mt-2 whitespace-nowrap">{fmtCur(value)}</div>
      {hint && <div className="text-xs text-gray-500 mt-1">{hint}</div>}
    </div>
  );
};

export default function NaturezaCards({ summary }) {
  const totalSaidas = summary.saidaTotal;
  const pct = (v) => (totalSaidas ? `${((v / totalSaidas) * 100).toFixed(1)}% das saídas` : "");
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
      <Card icon={Wallet} label="Entradas no período" value={summary.receita + summary.outrasEntradas} tone="verde"
        hint="Recebimentos classificados" />
      <Card icon={TrendingDown} label="Saídas totais" value={totalSaidas} tone="vermelho"
        hint="Sem transferências entre contas" />
      <Card icon={PiggyBank} label="OPEX — operação" value={summary.opex} tone="ambar" hint={pct(summary.opex)} />
      <Card icon={Hammer} label="CAPEX — investimento" value={summary.capex} tone="azul" hint={pct(summary.capex)} />
      <Card icon={HelpCircle} label="Em conta sintética" value={summary.sinteticasTotal} tone="ambar"
        hint="Sem detalhe analítico no ERP" />
      <Card icon={ArrowLeftRight} label="Movimentação entre contas" value={summary.movimentacao} tone="cinza"
        hint="Fora do resultado" />
    </div>
  );
}