import { useState, useMemo, useEffect, useRef } from "react";
import { useErpSnapshot } from "@/lib/ErpSnapshotContext";
import { Search, ChevronLeft, ChevronRight, Database } from "lucide-react";

export default function SnapshotTables() {
  const { snapshot, loading } = useErpSnapshot();
  const clients = snapshot?.top_clients || [];

  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [pendingMin, setPendingMin] = useState("");
  const [minValue, setMinValue] = useState("");
  const [sortBy, setSortBy] = useState("total");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchTerm(searchInput);
      setPage(1);
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchInput]);

  const filtered = useMemo(() => {
    let result = [...clients];
    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      result = result.filter(c => String(c.cd_pessoa).toLowerCase().includes(t) || (c.nm_pessoa || '').toLowerCase().includes(t));
    }
    if (minValue) {
      const min = parseFloat(minValue);
      if (!isNaN(min)) result = result.filter(c => c.total >= min);
    }
    result.sort((a, b) => {
      if (sortBy === "total") return b.total - a.total;
      if (sortBy === "nfs") return b.nfs - a.nfs;
      return 0;
    });
    return result;
  }, [clients, searchTerm, minValue, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const startIdx = (page - 1) * pageSize;
  const pageData = filtered.slice(startIdx, startIdx + pageSize);

  const applyFilters = () => {
    setMinValue(pendingMin);
    setPage(1);
  };
  const clearFilters = () => {
    setSearchInput("");
    setPendingMin("");
    setMinValue("");
    setSortBy("total");
    setPage(1);
  };

  if (loading) {
    return <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 h-64 animate-pulse" />;
  }

  if (!snapshot) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
        <Database className="w-12 h-12 text-gray-700 mx-auto mb-3" />
        <p className="text-gray-500 text-sm">Atualize os dados para visualizar os clientes.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="text-gray-500 text-xs mb-1 block">Buscar por ID ou nome</label>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-600 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { setSearchTerm(searchInput); setPage(1); } }}
                placeholder="Digite e aguarde (debounce 500ms)..."
                className="w-full bg-gray-950 text-gray-200 text-sm rounded-lg pl-9 pr-3 py-2 border border-gray-800 focus:border-purple-500 outline-none"
              />
            </div>
          </div>
          <div>
            <label className="text-gray-500 text-xs mb-1 block">Valor mínimo (R$)</label>
            <input
              type="number"
              value={pendingMin}
              onChange={e => setPendingMin(e.target.value)}
              placeholder="0"
              className="w-32 bg-gray-950 text-gray-200 text-sm rounded-lg px-3 py-2 border border-gray-800 focus:border-purple-500 outline-none"
            />
          </div>
          <div>
            <label className="text-gray-500 text-xs mb-1 block">Ordenar por</label>
            <select
              value={sortBy}
              onChange={e => { setSortBy(e.target.value); setPage(1); }}
              className="bg-gray-950 text-gray-200 text-sm rounded-lg px-3 py-2 border border-gray-800 outline-none"
            >
              <option value="total">Faturamento</option>
              <option value="nfs">Nº de NFs</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={applyFilters} className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium">Aplicar filtros</button>
            <button onClick={clearFilters} className="px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 rounded-lg text-sm">Limpar filtros</button>
          </div>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-800 border-b border-gray-700">
              <tr>
                <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase">ID</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase">Cliente</th>
                <th className="text-right px-4 py-3 text-gray-400 font-medium text-xs uppercase">Faturamento</th>
                <th className="text-right px-4 py-3 text-gray-400 font-medium text-xs uppercase">NFs</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase">Última NF</th>
              </tr>
            </thead>
            <tbody>
              {pageData.map((c, i) => (
                <tr key={i} className="border-b border-gray-800 hover:bg-gray-800/40">
                  <td className="px-4 py-3 text-gray-300 font-mono text-xs">{c.cd_pessoa}</td>
                  <td className="px-4 py-3 text-gray-200">{c.nm_pessoa || `Cliente ${c.cd_pessoa}`}</td>
                  <td className="px-4 py-3 text-right text-green-400 font-medium">{c.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
                  <td className="px-4 py-3 text-right text-gray-400">{c.nfs}</td>
                  <td className="px-4 py-3 text-gray-400">{c.ultima_nf || "—"}</td>
                </tr>
              ))}
              {pageData.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Nenhum cliente encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-gray-800">
          <span className="text-gray-500 text-xs">
            Exibindo {filtered.length === 0 ? 0 : startIdx + 1}–{Math.min(startIdx + pageSize, filtered.length)} de {filtered.length.toLocaleString("pt-BR")} clientes
          </span>
          <div className="flex items-center gap-3">
            <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }} className="bg-gray-950 text-gray-300 text-xs rounded px-2 py-1 border border-gray-800">
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="p-1 text-gray-400 hover:text-white disabled:opacity-30">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-gray-400 text-xs">Página {page} de {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="p-1 text-gray-400 hover:text-white disabled:opacity-30">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}