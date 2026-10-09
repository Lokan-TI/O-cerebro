import { Loader2 } from "lucide-react";

const br = (d) => d.split("-").reverse().join("/");

export default function OrcLocPeriods({ win, modeLabel, loading, error }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2">
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold text-white">Orçamentos x Locações fechadas</p>
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}
      </div>
      <p className="text-xs text-gray-500">
        Segue o período da análise RFM ({modeLabel}) · <b className="text-gray-300">{br(win.start)} a {br(win.end)}</b>. Aparecem na lista de clientes de cada segmento.
      </p>
      {error && <p className="text-xs text-red-400">Erro ao carregar orçamentos/locações: {error}</p>}
    </div>
  );
}