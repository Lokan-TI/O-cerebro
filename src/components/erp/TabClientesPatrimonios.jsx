import { useState, useMemo } from "react";
import { useErpSnapshot } from "@/lib/ErpSnapshotContext";
import { useEmpresaFilter } from "@/lib/EmpresaFilterContext";
import { fmtCur } from "@/lib/erpFormat";
import ClientePatrimoniosPanel from "@/components/erp/ClientePatrimoniosPanel";
import { Package, Search } from "lucide-react";

export default function TabClientesPatrimonios() {
  const { snapshot, loading } = useErpSnapshot();
  const { selectedEmpresa } = useEmpresaFilter();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);

  const clients = useMemo(() => {
    const isAll = selectedEmpresa == null;
    const raw = isAll
      ? (snapshot?.top_clients || [])
      : (snapshot?.top_clients_by_empresa || []).filter((c) => Number(c.cd_empresa) === selectedEmpresa);
    return raw
      .map((c) => ({
        cd_pessoa: String(c.cd_pessoa || ""),
        nm_pessoa: c.nm_pessoa || `Cliente ${c.cd_pessoa}`,
        receita: Number(c.total) || 0,
      }))
      .sort((a, b) => b.receita - a.receita);
  }, [snapshot, selectedEmpresa]);

  if (loading && !snapshot) return <div className="text-gray-500 p-8 text-center">Carregando clientes…</div>;
  if (!snapshot) return <div className="text-gray-500 p-8 text-center">Sem snapshot. Clique em "Atualizar dados" para carregar.</div>;

  const q = search.trim().toLowerCase();
  const filtered = q
    ? clients.filter((c) => c.nm_pessoa.toLowerCase().includes(q) || c.cd_pessoa.includes(q))
    : clients;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
        <div className="relative mb-3">
          <Search className="w-4 h-4 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente…"
            className="w-full pl-8 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500"
          />
        </div>
        <div className="max-h-[520px] overflow-y-auto space-y-1">
          {filtered.map((c) => (
            <button
              key={c.cd_pessoa}
              onClick={() => setSelected(c)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                selected?.cd_pessoa === c.cd_pessoa ? "bg-purple-600 text-white" : "text-gray-300 hover:bg-gray-800"
              }`}
            >
              <div className="truncate">{c.nm_pessoa}</div>
              <div className={`text-xs ${selected?.cd_pessoa === c.cd_pessoa ? "text-purple-200" : "text-gray-600"}`}>
                #{c.cd_pessoa} · {fmtCur(c.receita)}
              </div>
            </button>
          ))}
          {filtered.length === 0 && <div className="text-gray-600 text-sm text-center py-6">Nenhum cliente encontrado</div>}
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        {!selected ? (
          <div className="text-gray-500 text-center py-16">
            <Package className="w-6 h-6 text-purple-400 mx-auto mb-3" />
            Selecione um cliente ao lado para ver os patrimônios em posse e o histórico completo.
          </div>
        ) : (
          <>
            <div className="mb-4">
              <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                <Package className="w-4 h-4 text-purple-400" /> {selected.nm_pessoa}
              </h3>
              <div className="text-xs text-gray-600 mt-0.5">#{selected.cd_pessoa}</div>
            </div>
            <ClientePatrimoniosPanel cdPessoa={selected.cd_pessoa} />
          </>
        )}
      </div>
    </div>
  );
}