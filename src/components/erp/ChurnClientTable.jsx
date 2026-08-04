import { useState, useMemo } from "react";
import { Search, ArrowUpDown, Users } from "lucide-react";

const PAGE_SIZE = 15;

export default function ChurnClientTable({ clients }) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("ref_revenue");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    let list = clients || [];
    if (search) {
      list = list.filter(c => c.cd_pessoa?.toLowerCase().includes(search.toLowerCase()));
    }
    list = [...list].sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      if (typeof av === "string") return sortDir === "desc" ? bv.localeCompare(av) : av.localeCompare(bv);
      return sortDir === "desc" ? bv - av : av - bv;
    });
    return list;
  }, [clients, search, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(sortDir === "desc" ? "asc" : "desc");
    else { setSortKey(key); setSortDir("desc"); }
    setPage(0);
  };

  const fmtCurrency = (v) => v != null && !isNaN(v)
    ? Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
    : "—";
  const fmtDate = (d) => d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—";
  const monthsSince = (d) => {
    if (!d) return "—";
    const months = Math.round((Date.now() - new Date(d + "T00:00:00").getTime()) / (1000 * 60 * 60 * 24 * 30));
    return months + " meses";
  };

  if (!clients || clients.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
        <Users className="w-10 h-10 text-gray-700 mx-auto mb-2" />
        <p className="text-gray-400">Nenhum cliente perdido neste período.</p>
        <p className="text-gray-500 text-sm mt-1">Todos os clientes da base de referência continuaram comprando.</p>
      </div>
    );
  }

  const SortHeader = ({ k, children }) => (
    <th className="px-4 py-3 text-left cursor-pointer hover:text-white" onClick={() => toggleSort(k)}>
      <span className="flex items-center gap-1">{children} <ArrowUpDown className="w-3 h-3" /></span>
    </th>
  );

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <h3 className="text-white font-semibold text-sm">
          Clientes que Pararam de Fechar Locação ({filtered.length})
        </h3>
        <div className="relative">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            placeholder="Buscar por código..."
            className="bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-800/50 text-gray-400 text-xs uppercase tracking-wider">
              <SortHeader k="cd_pessoa">Código</SortHeader>
              <SortHeader k="ref_revenue">Receita (Período Ref.)</SortHeader>
              <SortHeader k="ref_nfs">NFs</SortHeader>
              <SortHeader k="ref_first_nf">Primeira NF</SortHeader>
              <SortHeader k="ref_last_nf">Última NF</SortHeader>
              <th className="px-4 py-3 text-left">Tempo Sem Comprar</th>
            </tr>
          </thead>
          <tbody>
            {pageData.map((c, i) => (
              <tr key={c.cd_pessoa} className={i % 2 === 0 ? "bg-gray-900" : "bg-gray-800/30"}>
                <td className="px-4 py-3 text-white font-medium">{c.cd_pessoa}</td>
                <td className="px-4 py-3 text-red-400 font-medium">{fmtCurrency(c.ref_revenue)}</td>
                <td className="px-4 py-3 text-gray-300">{c.ref_nfs}</td>
                <td className="px-4 py-3 text-gray-300">{fmtDate(c.ref_first_nf)}</td>
                <td className="px-4 py-3 text-gray-300">{fmtDate(c.ref_last_nf)}</td>
                <td className="px-4 py-3 text-orange-400">{monthsSince(c.ref_last_nf)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between p-4 border-t border-gray-800">
          <p className="text-gray-500 text-xs">Página {page + 1} de {totalPages}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 rounded-lg text-xs">
              Anterior
            </button>
            <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 rounded-lg text-xs">
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  );
}