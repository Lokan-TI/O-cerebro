import { useMemo, useState } from "react";
import { useErpSource, ALL_SOURCES_ID } from "@/lib/ErpSourceContext";
import { fmtNum, onlyDigits } from "@/lib/erpFormat";
import { exportFornecedoresCsv } from "@/components/erp/fornecedoresExport";
import SupplierTable from "@/components/erp/fornecedores/SupplierTable";
import SupplierEditDialog from "@/components/erp/fornecedores/SupplierEditDialog";
import PublicEnrichBar from "@/components/erp/fornecedores/PublicEnrichBar";
import useClienteCache from "./useClienteCache";
import { BadgeCheck, Download, RefreshCw, Search } from "lucide-react";

export default function ClientesCorrecaoCnpj() {
  const { sources, selectedSource } = useErpSource();
  const ids = selectedSource?.id && selectedSource.id !== ALL_SOURCES_ID
    ? [selectedSource.id] : (sources || []).filter((s) => s.id && s.id !== ALL_SOURCES_ID).map((s) => s.id);
  const cache = useClienteCache(ids);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const busy = cache.state !== "idle";

  const rows = useMemo(() => {
    const list = cache.rows || [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    const qd = onlyDigits(search);
    return list.filter((r) => `${r.nm_pessoa} ${r.nm_fan_pessoa}`.toLowerCase().includes(q) || (qd && onlyDigits(r.cnpj).includes(qd)));
  }, [cache.rows, search]);

  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm text-white flex items-center gap-2">
          <BadgeCheck className="w-4 h-4 text-purple-400" /> Correção cadastral de clientes (CNPJ)
          {cache.rows && <span className="text-xs text-gray-500">· {fmtNum(cache.rows.length)} clientes com CNPJ no Cérebro</span>}
        </div>
        <div className="flex gap-2">
          <button onClick={cache.syncFromErp} disabled={busy || !ids.length} className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-lg text-white text-xs font-medium">
            <RefreshCw className={`w-3.5 h-3.5 ${busy ? "animate-spin" : ""}`} /> {cache.rows ? "Atualizar do Sisloc" : "Carregar clientes"}
          </button>
          {cache.rows && (
            <button onClick={() => exportFornecedoresCsv(rows, { name: "clientes_cadastro_corrigido", sheet: "Clientes", skipCap: true })} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 rounded-lg text-white text-xs font-medium">
              <Download className="w-3.5 h-3.5" /> Exportar Excel
            </button>
          )}
        </div>
      </div>
      {cache.error && <div className="text-red-300 text-sm">{cache.error}</div>}
      {busy && <div className="text-gray-500 text-sm text-center py-4">{cache.progress || "Lendo clientes salvos no Cérebro…"}</div>}
      {!cache.rows && !busy && <div className="text-gray-500 text-sm text-center py-6 border border-dashed border-gray-800 rounded-lg">Clique em "Carregar clientes" para trazer todos os clientes do ERP com CNPJ válido.</div>}
      {cache.rows && !busy && (
        <>
          <PublicEnrichBar suppliers={cache.rows} savePublic={cache.savePublic} />
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou CNPJ…" className="pl-8 pr-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white w-72 focus:outline-none focus:border-purple-500" />
            </div>
            <span className="text-xs text-gray-600">{fmtNum(rows.length)} encontrados{rows.length > 300 ? " · exibindo 300 (o Excel inclui todos)" : ""}</span>
          </div>
          <div className="border border-gray-800 rounded-lg overflow-auto max-h-[480px]">
            <SupplierTable rows={rows.slice(0, 300)} onEdit={setEditing} hideCap />
          </div>
        </>
      )}
      <SupplierEditDialog row={editing} onClose={() => setEditing(null)} onSave={cache.saveCorrections} title="Corrigir cliente" />
    </div>
  );
}