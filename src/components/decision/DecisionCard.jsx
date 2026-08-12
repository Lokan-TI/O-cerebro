import { CheckCircle2, AlertTriangle, XCircle, Minus, EyeOff, Eye } from "lucide-react";

const TONE = {
  good: { ring: "border-emerald-800/60", text: "text-emerald-400", Icon: CheckCircle2, label: "Acima do mercado" },
  warn: { ring: "border-amber-800/60", text: "text-amber-400", Icon: AlertTriangle, label: "Atenção" },
  bad: { ring: "border-red-800/60", text: "text-red-400", Icon: XCircle, label: "Abaixo do mercado" },
  neutral: { ring: "border-gray-800", text: "text-gray-400", Icon: Minus, label: "Informativo" },
};

export default function DecisionCard({ kpi, editing, hidden, onToggle }) {
  const tone = TONE[kpi.status] || TONE.neutral;
  const { Icon } = tone;

  return (
    <div className={`relative bg-gray-900/60 border ${tone.ring} rounded-xl p-4 ${hidden ? "opacity-40" : ""}`}>
      {editing && (
        <button
          onClick={onToggle}
          aria-label={hidden ? `Mostrar ${kpi.label}` : `Ocultar ${kpi.label}`}
          className="absolute top-3 right-3 text-gray-500 hover:text-white"
        >
          {hidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>
      )}
      <p className="text-[11px] uppercase tracking-wider text-gray-500">{kpi.label}</p>
      <p className="text-2xl font-bold text-white mt-1">{kpi.value}</p>
      {kpi.sub && <p className="text-xs text-gray-500 mt-1">{kpi.sub}</p>}
      <div className={`flex items-start gap-1.5 mt-3 text-xs ${tone.text}`}>
        <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>{kpi.note ? `${kpi.note} · ${tone.label}` : tone.label}</span>
      </div>
      <p className="text-[11px] text-gray-600 mt-2 leading-snug">{kpi.market}</p>
    </div>
  );
}