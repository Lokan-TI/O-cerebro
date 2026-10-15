import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useGlobalFilter } from "@/lib/GlobalFilterContext";
import { loadCommercialKpis } from "@/lib/rdCommercialKpis";
import RdRankBars from "./RdRankBars";
import RdPendingKpis from "./RdPendingKpis";
import RdPlatformsKpi from "./RdPlatformsKpi";

const brl = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const num = (v) => v.toLocaleString("pt-BR");

function Card({ label, value, hint }) {
  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
      <p className="text-[11px] uppercase tracking-wider text-gray-500">{label}</p>
      <p className="text-xl font-semibold text-white mt-1 tabular-nums break-words">{value}</p>
      {hint && <p className="text-[11px] text-gray-500 mt-1">{hint}</p>}
    </div>
  );
}

export default function RdCommercialPanel() {
  const { period } = useGlobalFilter();
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    loadCommercialKpis(period).then(setD).finally(() => setLoading(false));
  }, [period.start, period.endExclusive]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading || !d) return <div className="flex items-center gap-2 text-sm text-gray-400 py-8 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Calculando KPIs comerciais…</div>;

  const o = d.owners;
  const rank = (k) => [...o].sort((a, b) => b[k] - a[k]).map((r) => ({ label: r.owner, value: r[k] }));
  const winRate = d.status.won + d.status.lost ? (d.status.won / (d.status.won + d.status.lost)) * 100 : null;

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-white">KPIs Comerciais</h3>
        <p className="text-[11px] text-gray-500">Fonte: negociações do RD CRM criadas entre {period.start} e {period.end} (período global). Consolidado RD — o filtro de empresa não se aplica, exceto em "Oportunidades por filial" (via vínculo com o ERP).</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        <Card label="Novas oportunidades" value={num(d.total)} />
        <Card label="Orçamentos em aberto" value={num(d.status.open)} hint={`${num(d.status.paused)} pausadas`} />
        <Card label="Vendas" value={num(d.status.won)} />
        <Card label="Perdidos / reprovados" value={num(d.status.lost)} />
        <Card label="Taxa de ganho" value={winRate == null ? "—" : `${winRate.toFixed(1)}%`} hint="ganhas ÷ (ganhas + perdidas)" />
        <Card label="Valor vendido (CRM)" value={brl(d.wonValue)} hint="valor negociado, não receita ERP" />
        <Card label="Ciclo de venda" value={d.cycleDays == null ? "—" : `${d.cycleDays.toFixed(0)} dias`} hint={`média de ${num(d.cycleSample)} vendas`} />
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        <RdRankBars title="Origem das oportunidades" rows={d.origins} />
        <RdRankBars title="Oportunidades por vendedor" rows={rank("total")} />
        <RdRankBars title="Orçamentos em aberto por vendedor" rows={rank("open")} />
        <RdRankBars title="Rank de vendas por vendedor (qtd.)" rows={rank("won")} />
        <RdRankBars title="Rank de vendas por vendedor (valor)" rows={rank("wonValue")} format={brl} />
        <RdRankBars title="Perdidos por vendedor" rows={rank("lost")} />
        <RdRankBars title="Visão geral das fases" rows={d.stages} max={12} />
        <RdPlatformsKpi period={period} />
        <RdRankBars title="Oportunidades por filial" rows={d.empresas} note="Parcial: só negociações vinculadas a um cliente do ERP." />
      </div>
      <RdPendingKpis />
    </section>
  );
}