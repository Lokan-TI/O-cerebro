import { TrendingUp, AlertTriangle, Target } from "lucide-react";

const ICONS = { oportunidade: TrendingUp, risco: AlertTriangle, acao: Target };
const TONES = {
  oportunidade: "text-emerald-400 border-emerald-900/50",
  risco: "text-amber-400 border-amber-900/50",
  acao: "text-purple-400 border-purple-900/50",
};

export default function InsightCard({ insight }) {
  const tipo = (insight.tipo || "acao").toLowerCase();
  const Icon = ICONS[tipo] || Target;
  const tone = TONES[tipo] || TONES.acao;

  return (
    <div className={`bg-gray-900/50 backdrop-blur border ${tone.split(" ")[1]} rounded-2xl p-5 h-full`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${tone.split(" ")[0]}`} />
        <span className="text-[10px] uppercase tracking-widest text-gray-500">{tipo}</span>
      </div>
      <h3 className="text-white font-semibold text-sm leading-snug">{insight.titulo}</h3>
      <p className="text-gray-400 text-xs mt-2 leading-relaxed">{insight.leitura}</p>
      {insight.acao && (
        <p className="text-gray-300 text-xs mt-3 pt-3 border-t border-gray-800">
          <span className="text-purple-300 font-medium">Faça: </span>{insight.acao}
        </p>
      )}
      {insight.referencia && (
        <p className="text-[11px] text-gray-600 mt-2 italic">{insight.referencia}</p>
      )}
    </div>
  );
}