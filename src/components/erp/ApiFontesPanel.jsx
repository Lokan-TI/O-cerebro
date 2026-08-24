import { Link } from "react-router-dom";
import { useRdStatus } from "@/lib/rdStatus";
import { Radio, Wifi, Loader2, ExternalLink } from "lucide-react";

// Fontes conectadas via API (RD Station), gerenciadas junto das fontes de banco do ERP.
export default function ApiFontesPanel() {
  const { catalog, status, loading, check } = useRdStatus();

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-white font-medium text-sm flex items-center gap-2">
            <Radio className="w-4 h-4 text-purple-400" /> Fontes via API
          </h3>
          <p className="text-gray-500 text-xs mt-0.5">
            Integrações conectadas por API ficam disponíveis aqui e no menu lateral, junto das bases do ERP.
          </p>
        </div>
        <Link to="/Integracoes" className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1">
          Abrir integrações <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {loading && catalog.length === 0 && (
        <p className="text-gray-500 text-sm flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Conferindo conexões de API…
        </p>
      )}

      <div className="space-y-1">
        {catalog.map((c) => {
          const st = status[c.product] || {};
          return (
            <div key={c.product} className="flex items-center gap-3 py-2 border-b border-gray-800 last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium">{c.label}</p>
                <p className="text-gray-600 text-xs truncate">{c.base_url} · {c.auth}</p>
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded-full border ${
                  st.checking
                    ? "text-gray-400 border-gray-700"
                    : st.ok
                    ? "text-emerald-400 border-emerald-700/60 bg-emerald-950/30"
                    : "text-red-400 border-red-700/60 bg-red-950/30"
                }`}
              >
                {st.checking ? "Testando…" : st.ok ? "Conectada" : "Erro de credencial"}
              </span>
              <button
                onClick={() => check(c.product)}
                disabled={st.checking}
                title="Testar conexão"
                className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-800 rounded disabled:opacity-50"
              >
                {st.checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
              </button>
              <Link
                to={`/Integracoes?product=${c.product}`}
                className="text-xs text-purple-400 hover:text-purple-300 whitespace-nowrap"
              >
                Gerenciar
              </Link>
            </div>
          );
        })}
      </div>

      {catalog.some((c) => status[c.product] && !status[c.product].ok && !status[c.product].checking) && (
        <p className="text-gray-600 text-xs mt-3">
          APIs com erro de credencial precisam do token/segredo revisado nas variáveis de ambiente do app.
        </p>
      )}
    </div>
  );
}