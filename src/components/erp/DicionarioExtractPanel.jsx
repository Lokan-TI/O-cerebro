import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useErpSource, ALL_SOURCES_ID } from "@/lib/ErpSourceContext";
import { BookOpen, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

// Dispara a extração completa do dicionário do ERP (v_Dicionario_Dados)
// e mostra o resultado da carga no MetadataCatalog.
export default function DicionarioExtractPanel() {
  const { selectedSource } = useErpSource();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const run = async () => {
    setRunning(true);
    setResult(null);
    setError(null);
    try {
      const payload = {};
      if (selectedSource?.id && selectedSource.id !== ALL_SOURCES_ID) payload.source_id = selectedSource.id;
      const res = await base44.functions.invoke("extractDataDictionary", payload);
      if (res.data?.success === false) throw new Error(res.data.error);
      setResult(res.data);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Falha na extração");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-white font-medium text-sm flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-purple-400" /> Dicionário de dados (catálogo de metadados)
          </h3>
          <p className="text-gray-500 text-xs mt-1">
            Extrai todas as tabelas e colunas do ERP e classifica domínio, tipo semântico e dados pessoais.
          </p>
        </div>
        <button
          onClick={run}
          disabled={running}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
          {running ? "Extraindo dicionário…" : "Extrair dicionário do ERP"}
        </button>
      </div>

      {running && <p className="text-gray-500 text-xs mt-3">Consultando o ERP e gravando o catálogo — pode levar até um minuto.</p>}

      {error && (
        <div className="mt-3 flex items-start gap-2 bg-red-950/40 border border-red-800/50 rounded-lg px-3 py-2 text-red-300 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {result && (
        <div className="mt-3 flex flex-wrap items-center gap-4 bg-emerald-950/30 border border-emerald-800/40 rounded-lg px-3 py-2 text-xs">
          <span className="flex items-center gap-1.5 text-emerald-300"><CheckCircle2 className="w-4 h-4" /> Catálogo atualizado</span>
          <span className="text-gray-300">{result.inserted?.toLocaleString("pt-BR")} colunas</span>
          <span className="text-gray-300">{result.tables?.toLocaleString("pt-BR")} tabelas</span>
          <span className="text-gray-300">{result.core_columns?.toLocaleString("pt-BR")} em tabelas críticas</span>
          <span className="text-amber-300">{result.pii_columns?.toLocaleString("pt-BR")} colunas com dado pessoal</span>
          <span className="text-gray-500">{Math.round((result.duration_ms || 0) / 1000)}s</span>
        </div>
      )}
    </div>
  );
}