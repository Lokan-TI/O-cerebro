import { fmtCur, fmtNum } from "@/lib/erpFormat";
import { UserPlus, FileText, Receipt, Percent, TrendingUp, DollarSign, UserX, FileWarning, Clock, Timer, Ticket, Copy } from "lucide-react";

const pctTxt = (v) => (v == null ? "—" : `${v.toFixed(1)}%`);
const dayTxt = (v) => (v == null ? "—" : `${v.toFixed(1)} d`);

function Card({ icon: Icon, label, value, hint, tone = "gray" }) {
  const tones = {
    purple: "border-purple-700/40 bg-purple-950/30 text-purple-400",
    blue: "border-blue-700/40 bg-blue-950/30 text-blue-400",
    green: "border-green-700/40 bg-green-950/30 text-green-400",
    amber: "border-amber-700/40 bg-amber-950/30 text-amber-400",
    red: "border-red-700/40 bg-red-950/30 text-red-400",
    gray: "border-gray-800 bg-gray-900 text-gray-400",
  };
  const [border, bg, text] = tones[tone].split(" ");
  return (
    <div className={`rounded-xl border p-4 ${border} ${bg}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${text}`} />
        <span className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {hint && <div className="text-[11px] text-gray-500 mt-1">{hint}</div>}
    </div>
  );
}

export default function ConversionKpis({ k }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card icon={UserPlus} tone="purple" label="Novos cadastros" value={fmtNum(k.novos_cadastros)} hint={`${fmtNum(k.nao_confirmados)} não confirmados como cliente`} />
        <Card icon={FileText} tone="blue" label="Clientes com ficha" value={fmtNum(k.com_ficha)} hint={`${fmtNum(k.sem_ficha)} sem ficha`} />
        <Card icon={Receipt} tone="green" label="Clientes com nota fiscal" value={fmtNum(k.com_nf)} hint={`${fmtNum(k.ficha_sem_nf)} com ficha sem NF`} />
        <Card icon={Percent} tone="blue" label="Cadastro → Ficha" value={pctTxt(k.taxa_cadastro_ficha)} hint="Conversão da 1ª etapa" />
        <Card icon={TrendingUp} tone="green" label="Cadastro → Nota fiscal" value={pctTxt(k.taxa_cadastro_nf)} hint={`Ficha → NF: ${pctTxt(k.taxa_ficha_nf)}`} />
        <Card icon={DollarSign} tone="green" label="Faturamento dos novos" value={fmtCur(k.faturamento_novos)} hint={`Média ${fmtCur(k.faturamento_medio_convertido)}/convertido`} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card icon={UserX} tone="amber" label="Cadastros sem ficha" value={pctTxt(k.taxa_sem_ficha)} hint={`${fmtNum(k.sem_ficha)} cadastros`} />
        <Card icon={FileWarning} tone="amber" label="Fichas sem faturamento" value={pctTxt(k.taxa_ficha_sem_nf)} hint={`${fmtNum(k.ficha_sem_nf)} clientes`} />
        <Card icon={Clock} label="Tempo médio até a ficha" value={dayTxt(k.tempo_medio_ficha)} hint={`Mediana ${dayTxt(k.tempo_mediano_ficha)}`} />
        <Card icon={Timer} label="Tempo médio até a NF" value={dayTxt(k.tempo_medio_nf)} hint={`Mediana ${dayTxt(k.tempo_mediano_nf)}`} />
        <Card icon={Ticket} label="Ticket médio inicial" value={fmtCur(k.ticket_primeira_nf)} hint={`${(k.nfs_por_cliente || 0).toFixed(1)} NFs por cliente`} />
        <Card icon={Copy} tone="red" label="Possíveis duplicidades" value={fmtNum(k.duplicidades)} hint={`${fmtNum(k.inconsistentes)} com dados inconsistentes`} />
      </div>
    </div>
  );
}