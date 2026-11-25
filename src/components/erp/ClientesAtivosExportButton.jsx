import { useState } from "react";
import { useErpSource, ALL_SOURCES_ID } from "@/lib/ErpSourceContext";
import { exportClientesAtivos } from "@/components/erp/clientesAtivosExport";
import { fmtNum } from "@/lib/erpFormat";
import { Download, Loader2 } from "lucide-react";

// "Exportar Excel" das listas de clientes ativos: colunas da tabela + contatos buscados no Sisloc.
export default function ClientesAtivosExportButton({ rows, padrao }) {
  const { selectedSource } = useErpSource();
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);

  const handleExport = async () => {
    setError(null);
    setProgress("");
    try {
      const sourceId = selectedSource?.id && selectedSource.id !== ALL_SOURCES_ID ? selectedSource.id : null;
      await exportClientesAtivos(rows, padrao, sourceId, (done, total) => setProgress(`${fmtNum(done)}/${fmtNum(total)}`));
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "falha ao buscar os contatos no Sisloc");
    } finally {
      setProgress(null);
    }
  };

  return (
    <>
      {error && <span className="text-red-300 text-xs max-w-xs">Exportação não concluída: {error}</span>}
      <button
        onClick={handleExport}
        disabled={progress !== null || !padrao}
        title={padrao ? undefined : "Aguardando os dados de locação da tabela"}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 rounded-lg text-white text-xs font-medium"
      >
        {progress !== null
          ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Buscando contatos… {progress}</>
          : <><Download className="w-3.5 h-3.5" /> Exportar Excel</>}
      </button>
    </>
  );
}