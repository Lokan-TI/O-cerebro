import { Link } from "react-router-dom";
import { useRdStatus } from "@/lib/rdStatus";
import { Loader2 } from "lucide-react";

// Mostra no menu lateral cada API já conectada, como uma fonte de dados navegável.
export default function ApiConnectionsNav({ onNavigate }) {
  const { catalog, status, loading } = useRdStatus();
  const connected = catalog.filter((c) => status[c.product]?.ok);

  if (loading && connected.length === 0) {
    return (
      <div>
        <p className="px-2 text-[10px] uppercase tracking-widest text-purple-500/80 mb-1.5">APIs conectadas</p>
        <span className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Conferindo conexões…
        </span>
      </div>
    );
  }

  return (
    <div>
      <p className="px-2 text-[10px] uppercase tracking-widest text-purple-500/80 mb-1.5">APIs conectadas</p>
      <div className="space-y-0.5">
        {connected.length === 0 && (
          <span className="block px-3 py-2 text-sm text-gray-600">Nenhuma API conectada ainda</span>
        )}
        {connected.map((c) => (
          <Link
            key={c.product}
            to={`/Integracoes?product=${c.product}`}
            onClick={onNavigate}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-900 transition-colors"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
            {c.label}
          </Link>
        ))}
      </div>
    </div>
  );
}