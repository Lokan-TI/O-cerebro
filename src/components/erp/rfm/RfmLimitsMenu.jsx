import { useState } from "react";
import { Settings } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LIMITS, validateLimits } from "@/lib/rfm";

const ROWS = [
  ["R", "Recência (dias, decrescente)", "R1 ≥ · R2 ≥ · R3 ≥ · R4 ≥"],
  ["F", "Frequência (nº de NFs)", "F2 ≥ · F3 ≥ · F4 ≥ · F5 ≥"],
  ["M", "Valor Monetário (R$)", "M2 ≥ · M3 ≥ · M4 ≥ · M5 ≥"],
];

export default function RfmLimitsMenu({ limits, onSave }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(limits);
  const [err, setErr] = useState(null);
  const onOpen = (o) => { setOpen(o); if (o) { setDraft(limits); setErr(null); } };
  const set = (k, i, v) => setDraft((d) => ({ ...d, [k]: d[k].map((x, j) => (j === i ? Number(v) : x)) }));
  const save = () => {
    const e = validateLimits(draft);
    if (e) return setErr(e);
    onSave(draft); setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={onOpen}>
      <PopoverTrigger asChild>
        <button title="Editar limites RFM" className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"><Settings className="w-4 h-4" /></button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 bg-gray-900 border-gray-700 text-gray-200 space-y-3">
        <p className="text-sm font-semibold text-white">Limites de classificação RFM</p>
        {ROWS.map(([k, label, hint]) => (
          <div key={k}>
            <p className="text-xs text-gray-300">{label}</p>
            <p className="text-[10px] text-gray-500 mb-1">{hint}</p>
            <div className="grid grid-cols-4 gap-1.5">
              {draft[k].map((v, i) => (
                <input key={i} type="number" min="0" value={v} onChange={(e) => set(k, i, e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs" />
              ))}
            </div>
          </div>
        ))}
        {err && <p className="text-xs text-red-400">{err}</p>}
        <div className="flex justify-between pt-1">
          <button onClick={() => { setDraft(LIMITS); setErr(null); }} className="text-xs text-gray-400 hover:text-white">Restaurar padrão</button>
          <button onClick={save} className="text-xs bg-purple-600 hover:bg-purple-500 text-white rounded-md px-3 py-1.5">Aplicar</button>
        </div>
      </PopoverContent>
    </Popover>
  );
}