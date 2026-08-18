import { BENCHMARKS, classify } from "@/lib/longTermProjection";
import { fmtCur, fmtNum } from "@/lib/erpFormat";
import { TrendingUp, Percent, Truck, Timer, Wallet, Repeat } from "lucide-react";

const COLORS = {
  green: "border-green-700/40 bg-green-950/30",
  amber: "border-amber-700/40 bg-amber-950/30",
  red: "border-red-700/40 bg-red-950/30",
  gray: "border-gray-700/40 bg-gray-900/40",
};

function Card({ icon: Icon, label, value, sub, refText, color = "gray" }) {
  return (
    <div className={`rounded-xl border p-4 ${COLORS[color]}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-gray-400" />
        <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-xl md:text-2xl font-bold text-white break-words leading-tight">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
      {refText && <div className="text-[11px] text-gray-600 mt-1">Referência de mercado: {refText}</div>}
    </div>
  );
}

const pct = (v) => (v == null ? "—" : `${v.toFixed(1)}%`);

export default function ProjectionKpiCards({ kpis }) {
  if (!kpis) return null;
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
      <Card
        icon={TrendingUp} label="Receita do ano" value={fmtCur(kpis.receita_atual)}
        sub={kpis.receita_parcial ? `${kpis.ano_atual} anualizado` : String(kpis.ano_atual)}
      />
      <Card
        icon={Percent} label="CAGR 5 anos" value={pct(kpis.cagr_5a)}
        sub={`10 anos: ${pct(kpis.cagr_10a)} · 3 anos: ${pct(kpis.cagr_3a)}`}
        color={kpis.cagr_5a == null ? "gray" : kpis.cagr_5a >= 10 ? "green" : "amber"}
      />
      <Card
        icon={Truck} label="Yield da frota" value={pct(kpis.yield_frota)}
        sub={`${fmtCur(kpis.valor_frota)} em ${fmtNum(kpis.ativos_ativos)} ativos`}
        refText={`${BENCHMARKS.yield_frota.min}% a ${BENCHMARKS.yield_frota.max}% ao ano`}
        color={classify(kpis.yield_frota, BENCHMARKS.yield_frota)}
      />
      <Card
        icon={Timer} label="Payback do ativo" value={kpis.payback_anos == null ? "—" : `${kpis.payback_anos.toFixed(1)} anos`}
        sub="Valor da frota ÷ receita anual"
        refText={`${BENCHMARKS.payback.min} a ${BENCHMARKS.payback.max} anos`}
        color={classify(kpis.payback_anos, BENCHMARKS.payback)}
      />
      <Card
        icon={Wallet} label="Reinvestimento" value={pct(kpis.capex_ratio_3a)}
        sub={`CAPEX últimos 12m: ${fmtCur(kpis.capex_ultimo_ano)}`}
        refText={`${BENCHMARKS.reinvestimento.min}% a ${BENCHMARKS.reinvestimento.max}% da receita`}
        color={classify(kpis.capex_ratio_3a, BENCHMARKS.reinvestimento)}
      />
      <Card
        icon={Repeat} label="Idade média da frota"
        value={kpis.idade_media == null ? "—" : `${kpis.idade_media.toFixed(1)} anos`}
        sub={`${fmtNum(kpis.ativos_acima_10a)} ativos acima de 10 anos`}
        refText={`${BENCHMARKS.idade_frota.min} a ${BENCHMARKS.idade_frota.max} anos`}
        color={classify(kpis.idade_media, BENCHMARKS.idade_frota)}
      />
    </div>
  );
}