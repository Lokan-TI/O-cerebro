import { fmtNum } from "@/lib/erpFormat";
import { X } from "lucide-react";

// Status da Ficha de Locação no vocabulário do Sisloc (mesma ordem e cores da tela do ERP).
export const FICHA_STATUS = [
  { id: "fichas_aberta", label: "Aberta", dot: "bg-green-500", on: "border-green-500 bg-green-950/40 text-green-200" },
  { id: "fichas_orcamento", label: "Orçamento", dot: "bg-blue-500", on: "border-blue-500 bg-blue-950/40 text-blue-200" },
  { id: "fichas_orc_vencido", label: "Orç. Vencido", dot: "bg-purple-500", on: "border-purple-500 bg-purple-950/40 text-purple-200" },
  { id: "fichas_lembrete", label: "Lembrete", dot: "bg-cyan-400", on: "border-cyan-400 bg-cyan-950/40 text-cyan-200" },
  { id: "fichas_suspensa", label: "Suspensa", dot: "bg-gray-400", on: "border-gray-400 bg-gray-700/40 text-gray-100" },
  { id: "fichas_encerrada", label: "Encerrada", dot: "bg-red-500", on: "border-red-500 bg-red-950/40 text-red-200" },
];

// Filtro por status da ficha; `counts` traz a quantidade de cada status na visão atual (clientes ou fichas).
export default function FichaStatusFilter({ value, onChange, counts }) {
  const toggle = (id) => onChange(value.includes(id) ? value.filter((s) => s !== id) : [...value, id]);
  const count = (id) => counts[id] || 0;

  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">Status da ficha de locação</label>
      <div className="flex items-center gap-2 flex-wrap">
        {FICHA_STATUS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => toggle(s.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${value.includes(s.id) ? s.on : "border-gray-700 bg-gray-800 text-gray-400 hover:text-gray-200"}`}
          >
            <span className={`w-2 h-2 rounded-sm ${s.dot}`} />
            {s.label}
            <span className="text-gray-500 font-normal">{fmtNum(count(s.id))}</span>
          </button>
        ))}
        {value.length > 0 && (
          <button type="button" onClick={() => onChange([])} className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-400 hover:text-white">
            <X className="w-3.5 h-3.5" /> Limpar
          </button>
        )}
      </div>
    </div>
  );
}