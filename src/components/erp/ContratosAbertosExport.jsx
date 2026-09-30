import { useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { getEmpresaLabel } from "@/lib/empresaLabels";
import { fetchContratos, exportContratosXlsx } from "./contratosAbertosExport";
import { buildResumo } from "./contratosResumo";
import ContratosResumoTable from "./ContratosResumoTable";

export default function ContratosAbertosExport({ sourceId, empresas = [] }) {
  const [empresa, setEmpresa] = useState(empresas[0] ? String(empresas[0].cd_empresa) : "");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [resumo, setResumo] = useState(null);

  const run = async () => {
    setLoading(true); setMsg("Buscando contratos...");
    try {
      const rows = await fetchContratos(sourceId, empresa, (n) => setMsg(`${n} itens carregados...`));
      setMsg("Buscando renovações...");
      const renovs = await fetchContratos(sourceId, empresa, (n) => setMsg(`${n} renovações carregadas...`), "renovacoes");
      setResumo(buildResumo(rows));
      const n = exportContratosXlsx(rows, renovs);
      setMsg(`${n} contratos abertos · ${rows.length} itens exportados`);
    } catch (e) {
      setMsg(`Erro: ${e.message}`);
    }
    setLoading(false);
  };

  return (
    <>
    <div className="px-4 py-3 border-b border-gray-800 flex flex-wrap items-center gap-2">
      <span className="text-gray-300 text-xs font-medium">Fichas com status "Aberta" (igual ao Sisloc):</span>
      <select value={empresa} onChange={(e) => setEmpresa(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs">
        <option value="">Todas as empresas</option>
        {empresas.map((e) => <option key={String(e.cd_empresa)} value={String(e.cd_empresa)}>{getEmpresaLabel(e.cd_empresa, e.empresa_nome)}</option>)}
      </select>
      {msg && <span className={`text-xs ${msg.startsWith("Erro") ? "text-red-400" : "text-gray-500"}`}>{msg}</span>}
      <button onClick={run} disabled={loading || !sourceId} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-violet-700 hover:bg-violet-600 rounded-lg text-white text-xs font-medium disabled:opacity-50">
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />} Exportar contratos
      </button>
    </div>
    <ContratosResumoTable linhas={resumo} />
    </>
  );
}