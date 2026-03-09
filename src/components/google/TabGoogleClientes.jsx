import { useState, useMemo } from "react";
import { CLIENTES_WON } from "@/components/google/googleData.jsx";

const fmtR = (v) => "R$ " + (v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function TabGoogleClientes() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("todos");
  const [sort, setSort] = useState("receita_total");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  const filtered = useMemo(() => {
    let data = CLIENTES_WON.filter(c => {
      const q = search.toLowerCase();
      const match = c.cliente.toLowerCase().includes(q) || c.resp.toLowerCase().includes(q) || c.local.toLowerCase().includes(q);
      const f = filter === "todos" ||
        (filter === "recompra" && c.fechados_pos > 0) ||
        (filter === "sem_recompra" && c.fechados_pos === 0);
      return match && f;
    });
    data = [...data].sort((a, b) => {
      const av = a[sort] ?? 0; const bv = b[sort] ?? 0;
      return sortDir === "desc" ? bv - av : av - bv;
    });
    return data;
  }, [search, filter, sort, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function toggleSort(field) {
    if (sort === field) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSort(field); setSortDir("desc"); }
    setPage(1);
  }

  function SortBtn({ field, label }) {
    const active = sort === field;
    return (
      <button onClick={() => toggleSort(field)} className={`flex items-center gap-1 ${active ? "text-white" : "text-gray-400 hover:text-gray-200"}`}>
        {label} <span className="text-xs">{active ? (sortDir === "desc" ? "↓" : "↑") : "↕"}</span>
      </button>
    );
  }

  const totalReceita = filtered.reduce((s, c) => s + (c.receita_total || 0), 0);
  const totalRetido = filtered.reduce((s, c) => s + (c.retido || 0), 0);

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <input
          type="text"
          placeholder="Buscar cliente, responsável, local…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="bg-gray-800 border border-gray-700 text-white text-sm rounded-md px-3 py-2 w-full sm:w-80 focus:outline-none focus:border-blue-500"
        />
        <div className="flex gap-2">
          {[
            { id: "todos", label: "Todos" },
            { id: "recompra", label: "Com Recompra" },
            { id: "sem_recompra", label: "Sem Recompra" },
          ].map(f => (
            <button key={f.id} onClick={() => { setFilter(f.id); setPage(1); }}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${filter === f.id ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="ml-auto text-sm text-gray-500">{filtered.length} clientes</div>
      </div>

      {/* Totais filtrados */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <p className="text-gray-400 text-xs uppercase tracking-wider">Receita Total (filtro)</p>
          <p className="text-xl font-bold text-blue-400 mt-1">{fmtR(totalReceita)}</p>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <p className="text-gray-400 text-xs uppercase tracking-wider">$$ Retido (filtro)</p>
          <p className="text-xl font-bold text-yellow-400 mt-1">{fmtR(totalRetido)}</p>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs">
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Cliente</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Resp.</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Local</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Produto FT</th>
                <th className="text-right px-4 py-3 font-medium"><SortBtn field="valor_ft" label="Valor FT" /></th>
                <th className="text-right px-4 py-3 font-medium"><SortBtn field="fechados_total" label="Fechados" /></th>
                <th className="text-right px-4 py-3 font-medium"><SortBtn field="fechados_pos" label="Recompras" /></th>
                <th className="text-right px-4 py-3 font-medium"><SortBtn field="receita_total" label="Receita Total" /></th>
                <th className="text-right px-4 py-3 font-medium"><SortBtn field="retido" label="$$ Retido" /></th>
              </tr>
            </thead>
            <tbody>
              {paged.map((c, i) => (
                <tr key={i} className="border-b border-gray-800 hover:bg-gray-800 transition-colors">
                  <td className="px-4 py-3">
                    <span className="text-gray-200 font-medium">{c.cliente}</span>
                    {c.fechados_pos > 0 && (
                      <span className="ml-2 text-xs bg-purple-900/40 text-purple-300 border border-purple-800 px-1.5 py-0.5 rounded-full">♻ recompra</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{c.resp}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{c.local}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-[120px] truncate" title={c.produto}>{c.produto}</td>
                  <td className="px-4 py-3 text-right text-gray-300 text-xs">{fmtR(c.valor_ft)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-white font-semibold">{c.fechados_total}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {c.fechados_pos > 0
                      ? <span className="text-purple-400 font-semibold">{c.fechados_pos}</span>
                      : <span className="text-gray-600">0</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-blue-400 font-semibold">{fmtR(c.receita_total)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {c.retido > 0
                      ? <span className="text-yellow-400 font-semibold">{fmtR(c.retido)}</span>
                      : <span className="text-gray-600">—</span>
                    }
                  </td>
                </tr>
              ))}
              {paged.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-600">Nenhum cliente encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="p-4 flex items-center justify-between border-t border-gray-800">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              className="text-sm text-gray-400 hover:text-white disabled:opacity-30 px-3 py-1 rounded border border-gray-700">
              ← Anterior
            </button>
            <span className="text-gray-500 text-sm">Página {page} de {totalPages}</span>
            <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
              className="text-sm text-gray-400 hover:text-white disabled:opacity-30 px-3 py-1 rounded border border-gray-700">
              Próxima →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}