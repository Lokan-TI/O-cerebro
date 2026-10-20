import { useState, useMemo } from "react";
import useSupplierCache from "@/components/erp/fornecedores/useSupplierCache";
import SupplierEditDialog from "@/components/erp/fornecedores/SupplierEditDialog";
import { useErpSource, ALL_SOURCES_ID } from "@/lib/ErpSourceContext";
import { fmtCur, fmtNum, fmtDoc, onlyDigits } from "@/lib/erpFormat";
import { exportFornecedoresCsv } from "@/components/erp/fornecedoresExport";
import SupplierEmailAudit from "@/components/erp/fornecedores/SupplierEmailAudit";
import { Truck, Download, RefreshCw, Search } from "lucide-react";
import SupplierTable from "@/components/erp/fornecedores/SupplierTable";
import PublicEnrichBar from "@/components/erp/fornecedores/PublicEnrichBar";

export default function TabFornecedores() {
  const { selectedSource } = useErpSource();
  const sourceKey = selectedSource?.id && selectedSource.id !== ALL_SOURCES_ID ? selectedSource.id : "all";
  const cache = useSupplierCache(sourceKey);
  const data = cache.rows ? { suppliers: cache.rows } : null;
  const loading = cache.state !== "idle";
  const error = cache.error;
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [onlyComCap, setOnlyComCap] = useState(false);
  const load = cache.syncFromErp;

  const rows = useMemo(() => {
    let list = data?.suppliers || [];
    if (onlyComCap) list = list.filter((r) => r.cap_qtd > 0);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const qd = onlyDigits(search);
      list = list.filter(
        (r) =>
          r.nm_pessoa.toLowerCase().includes(q) ||
          r.nm_fan_pessoa.toLowerCase().includes(q) ||
          (qd && (onlyDigits(r.cnpj).includes(qd) || onlyDigits(r.cpf).includes(qd)))
      );
    }
    return [...list].sort((a, b) => b.cap_total - a.cap_total);
  }, [data, search, onlyComCap]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (t, r) => ({
          qtd: t.qtd + r.cap_qtd,
          total: t.total + r.cap_total,
          aberto: t.aberto + r.cap_aberto,
          vencido: t.vencido + r.cap_vencido,
        }),
        { qtd: 0, total: 0, aberto: 0, vencido: 0 }
      ),
    [rows]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm text-gray-400 flex items-center gap-2">
          <Truck className="w-4 h-4 text-purple-400" />
          Fornecedores cadastrados (relacionamento fornecedor) — consumo em Contas a Pagar
          {data && <span className="text-gray-600">· {fmtNum(data.suppliers.length)} fornecedores no Cérebro · carga de {new Date(cache.syncedAt).toLocaleString("pt-BR")}</span>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-lg text-white text-xs font-medium"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            {data ? "Atualizar do Sisloc" : "Carregar fornecedores"}
          </button>
          {data && (
            <button
              onClick={() => exportFornecedoresCsv(rows)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 rounded-lg text-white text-xs font-medium"
            >
              <Download className="w-3.5 h-3.5" /> Exportar Excel
            </button>
          )}
        </div>
      </div>

      {error && <div className="bg-red-950/40 border border-red-800/50 rounded-lg px-4 py-2 text-red-300 text-sm">{error}</div>}

      {!data && !loading && !error && (
        <div className="text-gray-500 p-8 text-center border border-dashed border-gray-800 rounded-xl">
          Clique em "Carregar fornecedores" para consultar o cadastro e o consumo no Contas a Pagar.
        </div>
      )}
      {loading && <div className="text-gray-500 p-8 text-center">{cache.progress || "Lendo fornecedores salvos no Cérebro…"}</div>}

      <SupplierEditDialog row={editing} onClose={() => setEditing(null)} onSave={cache.saveCorrections} />

      {data && !loading && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
              <div className="text-xs text-gray-500 uppercase">Títulos (total)</div>
              <div className="text-xl font-bold text-white">{fmtNum(totals.qtd)}</div>
            </div>
            <div className="bg-gray-900 border border-red-800/40 rounded-xl p-3">
              <div className="text-xs text-gray-500 uppercase">Consumo total (CAP)</div>
              <div className="text-xl font-bold text-red-400">{fmtCur(totals.total)}</div>
            </div>
            <div className="bg-gray-900 border border-amber-800/40 rounded-xl p-3">
              <div className="text-xs text-gray-500 uppercase">Em aberto</div>
              <div className="text-xl font-bold text-amber-400">{fmtCur(totals.aberto)}</div>
            </div>
            <div className="bg-gray-900 border border-red-800/40 rounded-xl p-3">
              <div className="text-xs text-gray-500 uppercase">Vencido</div>
              <div className="text-xl font-bold text-red-400">{fmtCur(totals.vencido)}</div>
            </div>
          </div>

          <PublicEnrichBar suppliers={data.suppliers} savePublic={cache.savePublic} />

          <SupplierEmailAudit suppliers={data.suppliers || []} onApplyPublic={cache.saveManyCorrections} />

          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome, CNPJ ou CPF…"
                className="pl-8 pr-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white w-72 focus:outline-none focus:border-purple-500"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
              <input type="checkbox" checked={onlyComCap} onChange={(e) => setOnlyComCap(e.target.checked)} className="accent-purple-600" />
              Somente com consumo registrado
            </label>
            <span className="text-xs text-gray-600">{fmtNum(rows.length)} exibidos</span>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-x-auto">
            <SupplierTable rows={rows.slice(0, 300)} onEdit={setEditing} />
            {rows.length > 300 && (
              <div className="text-xs text-gray-600 px-3 py-2 border-t border-gray-800">
                Exibindo os 300 maiores — a exportação inclui todos os {fmtNum(rows.length)} fornecedores filtrados.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}