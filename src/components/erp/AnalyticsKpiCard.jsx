import { TrendingUp, TrendingDown, AlertTriangle, Info } from "lucide-react";

export function fmtCurrency(v) {
  if (v == null || isNaN(v)) return "—";
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export function fmtCurrencyDetailed(v) {
  if (v == null || isNaN(v)) return "—";
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function fmtNumber(v) {
  if (v == null || isNaN(v)) return "—";
  return Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

export function fmtPercent(v, withSign = true) {
  if (v == null || isNaN(v)) return "—";
  const sign = withSign && v >= 0 ? "+" : "";
  return sign + Number(v).toFixed(1) + "%";
}

const ACCENT_MAP = {
  blue: { border: "border-blue-500", text: "text-blue-400", bg: "bg-blue-500/10" },
  purple: { border: "border-purple-500", text: "text-purple-400", bg: "bg-purple-500/10" },
  green: { border: "border-green-500", text: "text-green-400", bg: "bg-green-500/10" },
  yellow: { border: "border-yellow-500", text: "text-yellow-400", bg: "bg-yellow-500/10" },
  red: { border: "border-red-500", text: "text-red-400", bg: "bg-red-500/10" },
  cyan: { border: "border-cyan-500", text: "text-cyan-400", bg: "bg-cyan-500/10" },
  emerald: { border: "border-emerald-500", text: "text-emerald-400", bg: "bg-emerald-500/10" },
  orange: { border: "border-orange-500", text: "text-orange-400", bg: "bg-orange-500/10" },
  indigo: { border: "border-indigo-500", text: "text-indigo-400", bg: "bg-indigo-500/10" },
};

export default function AnalyticsKpiCard({ label, value, format = "number", sub, accent = "blue", trend }) {
  const c = ACCENT_MAP[accent] || ACCENT_MAP.blue;
  const fmt = format === "currency" ? fmtCurrency : format === "percent" ? (v) => fmtPercent(v) : fmtNumber;
  const trendIcon = trend === "up" ? <TrendingUp className="w-4 h-4 text-green-400" /> : trend === "down" ? <TrendingDown className="w-4 h-4 text-red-400" /> : null;

  return (
    <div className={`bg-gray-900 border-l-4 ${c.border} rounded-lg p-4 transition-colors hover:bg-gray-800/50`}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-gray-400 text-xs uppercase tracking-wider font-medium">{label}</p>
        {trendIcon}
      </div>
      <p className="text-2xl font-bold text-white tabular-nums">{fmt(value)}</p>
      {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
    </div>
  );
}