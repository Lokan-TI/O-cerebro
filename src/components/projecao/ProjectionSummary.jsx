import { fmtCur } from "@/lib/erpFormat";
import { Target, Layers, Banknote, Info } from "lucide-react";

export default function ProjectionSummary({ kpis, summary }) {
  if (!summary) return null;
  const card = "rounded-xl border border-purple-700/40 bg-purple-950/20 p-4";
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={card}>
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-purple-300" />
            <span className="text-xs text-gray-400 uppercase tracking-wide">Receita em {summary.ano_final}</span>
          </div>
          <div className="text-3xl font-bold text-white">{fmtCur(summary.receita_base)}</div>
          <div className="text-xs text-gray-400 mt-1">
            {summary.multiplo_base == null ? "—" : `${summary.multiplo_base.toFixed(1)}x`} a receita de hoje ·
            CAGR de {summary.cagr_base == null ? "—" : `${summary.cagr_base.toFixed(1)}%`}
          </div>
          <div className="text-xs text-gray-500 mt-2">
            Faixa: {fmtCur(summary.receita_conservador)} a {fmtCur(summary.receita_otimista)}
          </div>
        </div>
        <div className={card}>
          <div className="flex items-center gap-2 mb-2">
            <Layers className="w-4 h-4 text-purple-300" />
            <span className="text-xs text-gray-400 uppercase tracking-wide">Frota necessária</span>
          </div>
          <div className="text-3xl font-bold text-white">{fmtCur(summary.frota_necessaria)}</div>
          <div className="text-xs text-gray-400 mt-1">Hoje: {fmtCur(kpis.valor_frota)}</div>
          <div className="text-xs text-gray-500 mt-2">
            Capital imobilizado exigido pelo yield informado
          </div>
        </div>
        <div className={card}>
          <div className="flex items-center gap-2 mb-2">
            <Banknote className="w-4 h-4 text-purple-300" />
            <span className="text-xs text-gray-400 uppercase tracking-wide">Investimento no período</span>
          </div>
          <div className="text-3xl font-bold text-white">{fmtCur(summary.capex_total)}</div>
          <div className="text-xs text-gray-400 mt-1">{fmtCur(summary.capex_medio_ano)} por ano em média</div>
          <div className="text-xs text-gray-500 mt-2">
            Receita acumulada de {fmtCur(summary.receita_acumulada)} em {summary.horizonte} anos
          </div>
        </div>
      </div>
      <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 flex gap-3 text-xs text-gray-400">
        <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p>
            <span className="text-gray-300 font-medium">Como o futuro é calculado:</span> o crescimento inicial de cada cenário parte do
            CAGR real do histórico e converge linearmente para o crescimento terminal ao longo do horizonte — nenhuma empresa
            sustenta taxa de expansão acelerada indefinidamente.
          </p>
          <p>
            A frota necessária vem da receita projetada dividida pelo yield da frota; o CAPEX é o que falta para chegar nela após a
            baixa anual dos ativos. Projeção é cenário, não previsão contratual: os dados são fato, as premissas são hipótese.
          </p>
        </div>
      </div>
    </div>
  );
}