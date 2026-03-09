import { useState } from "react";

export default function LeadsTable({ data }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  const filtered = data.filter((l) => {
    const q = search.toLowerCase();
    return (
      l.nome_contato?.toLowerCase().includes(q) ||
      l.empresa?.toLowerCase().includes(q) ||
      l.produto?.toLowerCase().includes(q) ||
      l.vendedor?.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800">
      <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-3 border-b border-gray-800">
        <h2 className="text-white font-semibold text-sm uppercase tracking-wider flex-1">Lista de Leads</h2>
        <input
          type="text"
          placeholder="Buscar por nome, empresa, produto ou vendedor…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="bg-gray-800 border border-gray-700 text-white text-sm rounded-md px-3 py-2 w-full sm:w-72 focus:outline-none focus:border-red-500"
        />
        <span className="text-gray-500 text-sm whitespace-nowrap">{filtered.length} resultados</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-4 py-3 text-gray-400 font-medium">#</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Contato</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Empresa</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Produto</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Data</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Vendedor</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((l, i) => (
              <tr key={i} className="border-b border-gray-800 hover:bg-gray-800 transition-colors">
                <td className="px-4 py-3 text-gray-600">{(page - 1) * PAGE_SIZE + i + 1}</td>
                <td className="px-4 py-3 text-gray-200">{l.nome_contato}</td>
                <td className="px-4 py-3 text-gray-300 max-w-[220px] truncate" title={l.empresa}>{l.empresa}</td>
                <td className="px-4 py-3">
                  <span className="bg-red-900/40 text-red-300 text-xs px-2 py-0.5 rounded-full border border-red-800">{l.produto}</span>
                </td>
                <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{l.data_orcamento}</td>
                <td className="px-4 py-3 text-gray-300">{l.vendedor}</td>
              </tr>
            ))}
            {paged.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-600">Nenhum lead encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="p-4 flex items-center justify-between border-t border-gray-800">
          <button
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            className="text-sm text-gray-400 hover:text-white disabled:opacity-30 px-3 py-1 rounded border border-gray-700 hover:border-gray-500 transition-colors"
          >← Anterior</button>
          <span className="text-gray-500 text-sm">Página {page} de {totalPages}</span>
          <button
            disabled={page === totalPages}
            onClick={() => setPage(p => p + 1)}
            className="text-sm text-gray-400 hover:text-white disabled:opacity-30 px-3 py-1 rounded border border-gray-700 hover:border-gray-500 transition-colors"
          >Próxima →</button>
        </div>
      )}
    </div>
  );
}