import { useEffect, useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useErpSource, ALL_SOURCES_ID } from "@/lib/ErpSourceContext";
import { useEmpresaFilter } from "@/lib/EmpresaFilterContext";
import { getEmpresaLabel } from "@/lib/empresaLabels";
import { exportMigracao } from "./migracaoExport";

export default function MigracaoExportButton() {
  const { selectedSource } = useErpSource();
  const { selectedEmpresa, empresaList, locked } = useEmpresaFilter();
  const sourceId = selectedSource?.id && selectedSource.id !== ALL_SOURCES_ID ? selectedSource.id : null;
  const [open, setOpen] = useState(false);
  const [empresa, setEmpresa] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => { if (open) { setEmpresa(selectedEmpresa == null ? "" : String(selectedEmpresa)); setMsg(null); } }, [open, selectedEmpresa]);

  const run = async () => {
    setLoading(true);
    try {
      const n = await exportMigracao(sourceId, empresa, setMsg);
      setMsg(n ? `${n} fichas abertas exportadas.` : "Nenhuma ficha aberta encontrada para esta seleção.");
    } catch (e) {
      setMsg(`Erro: ${e.message}`);
    }
    setLoading(false);
  };

  return (
    <Popover open={open} onOpenChange={(o) => !loading && setOpen(o)}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium text-emerald-300 hover:text-white hover:bg-emerald-700/40 transition-colors">
          <FileSpreadsheet className="w-3.5 h-3.5" /> Exportar fichas abertas
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 bg-gray-900 border-gray-700 text-white space-y-3">
        <div>
          <p className="text-sm font-semibold">Exportar fichas abertas (Excel)</p>
          <p className="text-xs text-gray-400">Uma linha por ficha com status "Aberta" no Sisloc, para migração ao novo ERP.</p>
        </div>
        {!sourceId ? (
          <p className="text-xs text-amber-300">Selecione uma fonte de dados específica no topo para exportar.</p>
        ) : (
          <>
            <label className="block text-xs text-gray-400">Empresa
              <select value={empresa} disabled={loading || locked} onChange={(e) => setEmpresa(e.target.value)}
                className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs">
                {!locked && <option value="">Todas as empresas</option>}
                {empresaList.map((e) => <option key={e.cd_empresa} value={String(e.cd_empresa)}>{getEmpresaLabel(e.cd_empresa, e.nm_empresa)}</option>)}
              </select>
            </label>
            <button onClick={run} disabled={loading} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-700 hover:bg-emerald-600 rounded-lg text-xs font-medium disabled:opacity-50">
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />} {loading ? "Gerando..." : "Baixar planilha"}
            </button>
          </>
        )}
        {msg && <p className={`text-xs ${msg.startsWith("Erro") ? "text-red-400" : "text-gray-400"}`}>{msg}</p>}
      </PopoverContent>
    </Popover>
  );
}