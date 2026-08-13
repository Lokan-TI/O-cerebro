import { useState } from "react";
import { Code2, X, Copy, Check } from "lucide-react";

// Botão + modal que exibe as queries SQL que compõem a tela atual.
// Recebe uma lista [{ label, description, sql }] — normalmente vinda da própria resposta do back-end.
export default function QueryInspector({ queries, title = "Queries desta tela" }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(null);

  if (!queries || queries.length === 0) return null;

  const copy = async (sql, i) => {
    await navigator.clipboard.writeText(sql);
    setCopied(i);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-300 hover:text-white text-xs font-medium"
      >
        <Code2 className="w-3.5 h-3.5" /> Ver query
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-4xl max-h-[85vh] flex flex-col"
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
              <div className="flex items-center gap-2 text-white font-medium">
                <Code2 className="w-4 h-4 text-purple-400" /> {title}
                <span className="text-xs text-gray-500">({queries.length})</span>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-5 space-y-4">
              {queries.map((q, i) => (
                <div key={i} className="border border-gray-800 rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 bg-gray-950/60 border-b border-gray-800">
                    <div>
                      <div className="text-sm text-white">{q.label}</div>
                      {q.description && <div className="text-xs text-gray-500">{q.description}</div>}
                    </div>
                    <button
                      onClick={() => copy(q.sql, i)}
                      className="flex items-center gap-1.5 px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-300"
                    >
                      {copied === i ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied === i ? "Copiado" : "Copiar"}
                    </button>
                  </div>
                  <pre className="p-3 text-xs text-gray-300 font-mono whitespace-pre-wrap leading-relaxed bg-gray-950/30">{q.sql}</pre>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}