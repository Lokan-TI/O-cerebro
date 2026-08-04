import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useErpSource } from "@/lib/ErpSourceContext";
import SourceStatusBadge from "@/components/erp/SourceStatusBadge";
import { Database, ChevronDown, Plus, Check, Settings2 } from "lucide-react";

export default function DataSourceDropdown() {
  const { sources, selectedSource, selectSource, loading } = useErpSource();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const activeSources = sources.filter((s) => s.is_active !== false);

  return (
    <div ref={ref} className="relative">
      <div className="flex flex-col gap-0.5">
        <label className="text-gray-500 text-xs uppercase tracking-wider">Fonte de dados do ERP</label>
        <button
          onClick={() => setOpen(!open)}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 bg-gray-900 hover:bg-gray-800 border border-gray-700 hover:border-purple-500 rounded-lg text-left min-w-[220px] transition-colors disabled:opacity-50"
        >
          <Database className="w-4 h-4 text-purple-400 shrink-0" />
          <div className="flex-1 min-w-0">
            {loading ? (
              <span className="text-gray-500 text-sm">Carregando...</span>
            ) : selectedSource ? (
              <span className="text-white text-sm font-medium truncate">{selectedSource.name}</span>
            ) : (
              <span className="text-gray-500 text-sm">Nenhuma fonte</span>
            )}
          </div>
          <ChevronDown className={`w-4 h-4 text-gray-500 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        <p className="text-gray-600 text-xs">Selecione a unidade cujo banco será utilizado nas consultas.</p>
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[280px] bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden">
          {activeSources.map((s) => (
            <button
              key={s.id}
              onClick={() => { selectSource(s.id); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-gray-800 text-left transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-white text-sm font-medium truncate">{s.name}</span>
                  {selectedSource?.id === s.id && <Check className="w-3.5 h-3.5 text-purple-400 shrink-0" />}
                </div>
                {s.branch_name && s.branch_name !== s.name && (
                  <span className="text-gray-500 text-xs">{s.branch_name}</span>
                )}
              </div>
              <SourceStatusBadge status={s.status} withDot={false} />
            </button>
          ))}
          {activeSources.length === 0 && (
            <p className="px-3 py-3 text-gray-500 text-sm">Nenhuma fonte ativa. Cadastre uma fonte para começar.</p>
          )}
          <div className="border-t border-gray-800">
            <button
              onClick={() => { setOpen(false); navigate("/GerenciarFontes"); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-gray-800 text-purple-400 text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" /> Adicionar nova fonte
            </button>
            <button
              onClick={() => { setOpen(false); navigate("/GerenciarFontes"); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-gray-800 text-gray-400 text-sm font-medium transition-colors"
            >
              <Settings2 className="w-4 h-4" /> Gerenciar fontes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}