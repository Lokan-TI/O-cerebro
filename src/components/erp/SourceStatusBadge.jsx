import { Wifi, WifiOff, RefreshCw, AlertTriangle, Settings, Pause, CircleDot } from "lucide-react";

const STATUS_MAP = {
  connected: { label: "Conectada", icon: Wifi, cls: "bg-green-950 text-green-400 border-green-800" },
  disconnected: { label: "Desconectada", icon: WifiOff, cls: "bg-gray-800 text-gray-400 border-gray-700" },
  syncing: { label: "Sincronizando", icon: RefreshCw, cls: "bg-blue-950 text-blue-400 border-blue-800" },
  error: { label: "Erro de conexão", icon: AlertTriangle, cls: "bg-red-950 text-red-400 border-red-800" },
  incomplete: { label: "Configuração incompleta", icon: Settings, cls: "bg-yellow-950 text-yellow-400 border-yellow-800" },
  mapping_pending: { label: "Mapeamento pendente", icon: CircleDot, cls: "bg-amber-950 text-amber-400 border-amber-800" },
  inactive: { label: "Inativa", icon: Pause, cls: "bg-gray-800 text-gray-500 border-gray-700" },
};

export default function SourceStatusBadge({ status, withDot = true, size = "sm" }) {
  const s = STATUS_MAP[status] || STATUS_MAP.disconnected;
  const Icon = s.icon;
  const spin = status === "syncing";
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${s.cls}`}>
      {withDot && <span className={`w-1.5 h-1.5 rounded-full ${spin ? "bg-current animate-pulse" : "bg-current"} ${status === "error" ? "bg-red-400" : ""}`} />}
      <Icon className={`w-3 h-3 ${spin ? "animate-spin" : ""}`} />
      {s.label}
    </span>
  );
}