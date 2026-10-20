import { Globe, Square } from "lucide-react";
import { fmtNum } from "@/lib/erpFormat";
import usePublicEnrich from "./usePublicEnrich";

export default function PublicEnrichBar({ suppliers, savePublic }) {
  const { state, progress, run, cancel } = usePublicEnrich(savePublic);
  const count = (s) => suppliers.filter((r) => r._pubStatus === s).length;
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-xs text-gray-400">
          Dados públicos (Receita): <span className="text-emerald-400">{fmtNum(count("ok"))} encontrados</span> · <span className="text-amber-400">{fmtNum(count("not_found"))} não encontrados</span> · <span className="text-red-400">{fmtNum(count("error"))} com erro</span>
        </div>
        {state === "running" ? (
          <button onClick={cancel} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-700 hover:bg-red-600 rounded-lg text-white text-xs"><Square className="w-3.5 h-3.5" /> Parar</button>
        ) : (
          <button onClick={() => run(suppliers)} className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded-lg text-white text-xs font-medium"><Globe className="w-3.5 h-3.5" /> Buscar dados públicos de todos</button>
        )}
      </div>
      {state !== "idle" && (
        <div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden"><div className="h-full bg-purple-500 transition-all" style={{ width: `${pct}%` }} /></div>
          <div className="text-[11px] text-gray-500 mt-1">{fmtNum(progress.done)}/{fmtNum(progress.total)} CNPJs · {state === "running" ? "salvando a cada lote…" : state === "stopped" ? "interrompido" : "concluído"}</div>
        </div>
      )}
    </div>
  );
}