import { useState } from "react";
import { CONVERSION_DOCS } from "@/lib/conversionDocs";
import { BookOpen, ChevronDown, ChevronRight } from "lucide-react";

export default function ConversionDocsPanel() {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 px-5 py-4 text-left">
        {open ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
        <BookOpen className="w-4 h-4 text-purple-400" />
        <span className="text-white font-semibold text-sm">Documentação técnica — relacionamentos, regras e consultas SQL</span>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-5">
          <div>
            <h4 className="text-xs uppercase text-gray-500 mb-2">Mapa de relacionamentos</h4>
            <div className="space-y-1">
              {CONVERSION_DOCS.relacionamentos.map((r, i) => (
                <div key={i} className="text-xs border-b border-gray-800/50 py-2">
                  <span className="text-blue-400 font-mono">{r.de}</span>
                  <span className="text-gray-600 mx-2">→</span>
                  <span className="text-green-400 font-mono">{r.para}</span>
                  <div className="text-gray-500 mt-0.5">{r.obs}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-xs uppercase text-gray-500 mb-2">Regras de negócio</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {CONVERSION_DOCS.regras.map((r, i) => (
                <div key={i} className="rounded-lg bg-gray-800/50 p-3">
                  <div className="text-white text-xs font-medium mb-1">{r.titulo}</div>
                  <div className="text-gray-400 text-xs">{r.texto}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-xs uppercase text-gray-500 mb-2">Consultas SQL (somente leitura, parametrizadas)</h4>
            <div className="space-y-3">
              {CONVERSION_DOCS.queries.map((q, i) => (
                <div key={i}>
                  <div className="text-xs text-gray-300 mb-1">{q.nome}</div>
                  <pre className="bg-black/60 border border-gray-800 rounded-lg p-3 text-[11px] text-gray-300 overflow-x-auto whitespace-pre">{q.sql}</pre>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-xs uppercase text-gray-500 mb-2">Limitações desta versão</h4>
            <ul className="list-disc list-inside space-y-1">
              {CONVERSION_DOCS.limitacoes.map((l, i) => (
                <li key={i} className="text-xs text-amber-300/80">{l}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}