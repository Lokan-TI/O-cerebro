import { Loader2 } from "lucide-react";

const inp = "bg-gray-800 border border-gray-700 rounded-md text-xs text-gray-200 px-2 py-1";

function Range({ label, value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400 w-24">{label}</span>
      <input type="date" value={value.start} onChange={(e) => onChange({ ...value, start: e.target.value })} className={inp} />
      <span className="text-xs text-gray-500">a</span>
      <input type="date" value={value.end} onChange={(e) => onChange({ ...value, end: e.target.value })} className={inp} />
    </div>
  );
}

export default function OrcLocPeriods({ orc, setOrc, loc, setLoc, loading, error }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2">
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold text-white">Orçamentos x Locações fechadas</p>
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}
      </div>
      <p className="text-xs text-gray-500">Períodos independentes do RFM. Aparecem na lista de clientes de cada segmento.</p>
      <div className="flex flex-wrap gap-x-8 gap-y-2">
        <Range label="Orçamentos" value={orc} onChange={setOrc} />
        <Range label="Locações" value={loc} onChange={setLoc} />
      </div>
      {error && <p className="text-xs text-red-400">Erro ao carregar orçamentos/locações: {error}</p>}
    </div>
  );
}