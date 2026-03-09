import { useState } from "react";

export default function TabLeads({ data }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState("data_orcamento");
  const [sortDir, setSortDir] = useState("desc");
  const PAGE_SIZE = 20;

  const filtered = data.filter((l) => {
    const q = search.toLowerCase();
    return (
      l.nome_contato?.toLowerCase().includes(q) ||
      l.empresa?.toLowerCase().includes(q) ||
      l.produto?.toLowerCase().includes(q) ||
      l.vendedor?.toLowerCase().includes(q) ||
      l.categoria?.toLowerCase().includes(q)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortField] || "";
    const bv = b[sortField] || "";
    return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
  });

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function toggleSort(field) {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
    setPage(1);
  }

  function SortBtn({ field, label }) {
    const active = sortField === field;
    return (
      <button onClick={() => toggleSort(field)} className={`flex items-center gap-1 ${active ? "text-white" : "text-gray-400 hover:text-gray-200"}`}>
        {label}
        <span className="text-xs">{active ? (sortDir === "asc" ? "↑" : "↓") : "↕"}</span>
      </button>
    );
  }

  const catColors = {
    "Tubular": "bg-red-900/40 text-red-300 border-red-800",
    "Multidirecional": "bg-blue-900/40 text-blue-300 border-blue-800",
    "Escoramento": "bg-yellow-900/40 text-yellow-300 border-yellow-800",
    "Fachadeiro": "bg-purple-900/40 text-purple-300 border-purple-800",
    "Andaime Locação": "bg-green-900/40 text-green-300 border-green-800",
    "Container": "bg-orange-900/40 text-orange-300 border-orange-800",
  };

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800">
      <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-3 border-b border-gray-800">
        <h2 className="text-white font-semibold text-sm uppercase tracking-wider flex-1">Lista Completa de Leads</h2>
        <input
          type="text"
          placeholder="Buscar por nome, empresa, produto, vendedor…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="bg-gray-800 border border-gray-700 text-white text-sm rounded-md px-3 py-2 w-full sm:w-80 focus:outline-none focus:border-red-500"
        />
        <span className="text-gray-500 text-sm whitespace-nowrap">{filtered.length} resultados</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-xs">
              <th className="text-left px-4 py-3 text-gray-400 font-medium">#</th>
              <th className="text-left px-4 py-3 font-medium"><SortBtn field="nome_contato" label="Contato" /></th>
              <th className="text-left px-4 py-3 font-medium"><SortBtn field="empresa" label="Empresa" /></th>
              <th className="text-left px-4 py-3 font-medium"><SortBtn field="categoria" label="Categoria" /></th>
              <th className="text-left px-4 py-3 font-medium"><SortBtn field="produto" label="Produto" /></th>
              <th className="text-left px-4 py-3 font-medium"><SortBtn field="data_orcamento" label="Data" /></th>
              <th className="text-left px-4 py-3 font-medium"><SortBtn field="vendedor" label="Vendedor" /></th>
            </tr>
          </thead>
          <tbody>
            {paged.map((l, i) => (
              <tr key={i} className="border-b border-gray-800 hover:bg-gray-800 transition-colors">
                <td className="px-4 py-3 text-gray-600">{(page - 1) * PAGE_SIZE + i + 1}</td>
                <td className="px-4 py-3 text-gray-200">{l.nome_contato}</td>
                <td className="px-4 py-3 text-gray-300 max-w-[200px] truncate" title={l.empresa}>{l.empresa}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${catColors[l.categoria] || "bg-gray-800 text-gray-400 border-gray-700"}`}>
                    {l.categoria}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs max-w-[140px] truncate" title={l.produto}>{l.produto}</td>
                <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{l.data_orcamento}</td>
                <td className="px-4 py-3 text-gray-300 text-xs">{l.vendedor}</td>
              </tr>
            ))}
            {paged.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-600">Nenhum lead encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="p-4 flex items-center justify-between border-t border-gray-800">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
            className="text-sm text-gray-400 hover:text-white disabled:opacity-30 px-3 py-1 rounded border border-gray-700 hover:border-gray-500 transition-colors">
            ← Anterior
          </button>
          <span className="text-gray-500 text-sm">Página {page} de {totalPages}</span>
          <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
            className="text-sm text-gray-400 hover:text-white disabled:opacity-30 px-3 py-1 rounded border border-gray-700 hover:border-gray-500 transition-colors">
            Próxima →
          </button>
        </div>
      )}
    </div>
  );
}