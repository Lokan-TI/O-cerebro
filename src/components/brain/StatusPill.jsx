import { CheckCircle2, AlertTriangle, XCircle, HelpCircle } from "lucide-react";

const MAP = {
  ok: { icon: CheckCircle2, cls: "text-green-400", label: "Adequado" },
  warn: { icon: AlertTriangle, cls: "text-amber-400", label: "Atenção" },
  bad: { icon: XCircle, cls: "text-red-400", label: "Crítico" },
  unknown: { icon: HelpCircle, cls: "text-gray-500", label: "Sem dado" },
};

export default function StatusPill({ status, showLabel = true }) {
  const s = MAP[status] || MAP.unknown;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${s.cls}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" />
      {showLabel && s.label}
    </span>
  );
}