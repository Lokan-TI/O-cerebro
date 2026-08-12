import { useErpSource, ALL_SOURCES_ID } from "@/lib/ErpSourceContext";
import { Database, Check, Layers } from "lucide-react";

export default function SourceSelector() {
  const { sources, selectedSource, selectSource, loading } = useErpSource();
  const currentId = selectedSource?.id;

  return (
    <div className="px-3 pt-4">
      <p className="px-2 text-[10px] uppercase tracking-widest text-purple-500/80 mb-1.5">Base de dados</p>
      <div className="space-y-0.5">
        <button
          onClick={() => selectSource(ALL_SOURCES_ID)}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
            currentId === ALL_SOURCES_ID ? "bg-purple-600/15 text-purple-300" : "text-gray-400 hover:text-white hover:bg-gray-900"
          }`}
        >
          <Layers className="w-4 h-4 shrink-0" />
          <span className="flex-1 text-left">Todas as bases (consolidado)</span>
          {currentId === ALL_SOURCES_ID && <Check className="w-4 h-4" />}
        </button>

        {loading && <p className="px-3 py-2 text-xs text-gray-600">Carregando fontes…</p>}
        {sources.map((s) => (
          <button
            key={s.id}
            onClick={() => selectSource(s.id)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              currentId === s.id ? "bg-purple-600/15 text-purple-300" : "text-gray-400 hover:text-white hover:bg-gray-900"
            }`}
          >
            <Database className="w-4 h-4 shrink-0" />
            <span className="flex-1 text-left truncate">{s.name}</span>
            {currentId === s.id && <Check className="w-4 h-4" />}
          </button>
        ))}
      </div>
      <p className="px-3 pt-2 text-[11px] text-gray-600">
        A base escolhida vale para todos os dashboards e para o cérebro.
      </p>
    </div>
  );
}