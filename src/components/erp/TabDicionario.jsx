import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useErpSource, ALL_SOURCES_ID } from "@/lib/ErpSourceContext";
import { fmtNum } from "@/lib/erpFormat";
import QueryInspector from "@/components/erp/QueryInspector";
import DicionarioColunas from "@/components/erp/DicionarioColunas";
import { BookOpen, Search, Loader2, ArrowLeft, Table2 } from "lucide-react";

export default function TabDicionario() {
  const { selectedSource } = useErpSource();
  const [tables, setTables] = useState([]);
  const [tableFilter, setTableFilter] = useState("");
  const [selected, setSelected] = useState(null);
  const [columns, setColumns] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [queries, setQueries] = useState(null);

  const call = useCallback(async (payload) => {
    const body = { ...payload };
    if (selectedSource?.id && selectedSource.id !== ALL_SOURCES_ID) body.source_id = selectedSource.id;
    const res = await base44.functions.invoke("listDicionarioDados", body);
    const data = res?.data || res;
    if (data?.success === false) throw new Error(data.error || "Falha ao consultar o dicionário");
    setQueries(data.queries || null);
    return data;
  }, [selectedSource]);

  const loadTables = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await call({});
      setTables(data.items || []);
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }, [call]);

  useEffect(() => { loadTables(); }, [loadTables]);

  const openTable = async (name) => {
    setSelected(name);
    setSearchResults(null);
    setColumns([]);
    setLoading(true);
    setError(null);
    try {
      const data = await call({ table: name });
      setColumns(data.items || []);
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  const runSearch = async () => {
    if (!searchTerm.trim()) return;
    setSelected(null);
    setLoading(true);
    setError(null);
    try {
      const data = await call({ search: searchTerm.trim() });
      setSearchResults(data.items || []);
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredTables = tables.filter((t) => t.tabela.toLowerCase().includes(tableFilter.trim().toLowerCase()));
  const totals = tables.reduce(
    (a, t) => ({ campos: a.campos + t.campos, fks: a.fks + t.fks, dominios: a.dominios + t.dominios }),
    { campos: 0, fks: 0, dominios: 0 }
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm text-gray-400 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-purple-400" />
          Dicionário de dados oficial do ERP — descrições de negócio, domínios de valores e relacionamentos
        </div>
        <QueryInspector queries={queries} title="Queries — Dicionário de dados" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
          <div className="text-xs text-gray-500 uppercase">Tabelas</div>
          <div className="text-xl font-bold text-white">{fmtNum(tables.length)}</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
          <div className="text-xs text-gray-500 uppercase">Campos</div>
          <div className="text-xl font-bold text-white">{fmtNum(totals.campos)}</div>
        </div>
        <div className="bg-gray-900 border border-emerald-800/40 rounded-xl p-3">
          <div className="text-xs text-gray-500 uppercase">Chaves estrangeiras</div>
          <div className="text-xl font-bold text-emerald-400">{fmtNum(totals.fks)}</div>
        </div>
        <div className="bg-gray-900 border border-indigo-800/40 rounded-xl p-3">
          <div className="text-xs text-gray-500 uppercase">Campos com domínio</div>
          <div className="text-xl font-bold text-indigo-300">{fmtNum(totals.dominios)}</div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
            placeholder="Buscar campo ou descrição em todo o ERP…"
            className="pl-8 pr-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white w-80 focus:outline-none focus:border-purple-500"
          />
        </div>
        <button
          onClick={runSearch}
          disabled={loading || !searchTerm.trim()}
          className="px-3 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-lg text-white text-xs font-medium"
        >
          Buscar
        </button>
        {(selected || searchResults) && (
          <button
            onClick={() => { setSelected(null); setSearchResults(null); }}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-300 text-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar às tabelas
          </button>
        )}
      </div>

      {error && <div className="bg-red-950/40 border border-red-800/50 rounded-lg px-4 py-2 text-red-300 text-sm">{error}</div>}
      {loading && (
        <div className="text-gray-500 p-8 text-center flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Consultando o dicionário no ERP…
        </div>
      )}

      {!loading && selected && (
        <>
          <div className="text-sm text-white font-mono flex items-center gap-2">
            <Table2 className="w-4 h-4 text-purple-400" /> {selected}
            <span className="text-xs text-gray-500 font-sans">{fmtNum(columns.length)} campos</span>
          </div>
          <DicionarioColunas items={columns} onSelectTable={openTable} />
        </>
      )}

      {!loading && !selected && searchResults && (
        <>
          <div className="text-xs text-gray-500">{fmtNum(searchResults.length)} campos encontrados (máx. 300)</div>
          <DicionarioColunas items={searchResults} showTable onSelectTable={openTable} />
        </>
      )}

      {!loading && !selected && !searchResults && (
        <>
          <div className="flex items-center gap-3">
            <input
              value={tableFilter}
              onChange={(e) => setTableFilter(e.target.value)}
              placeholder="Filtrar tabelas…"
              className="px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white w-64 focus:outline-none focus:border-purple-500"
            />
            <span className="text-xs text-gray-600">{fmtNum(filteredTables.length)} tabelas</span>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-x-auto max-h-[560px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-900">
                <tr className="text-gray-500 text-xs uppercase border-b border-gray-800">
                  <th className="text-left py-2 px-3">Tabela</th>
                  <th className="text-right py-2 px-3">Campos</th>
                  <th className="text-right py-2 px-3">Descritos</th>
                  <th className="text-right py-2 px-3">Domínios</th>
                  <th className="text-right py-2 px-3">FKs</th>
                </tr>
              </thead>
              <tbody>
                {filteredTables.map((t) => (
                  <tr
                    key={t.tabela}
                    onClick={() => openTable(t.tabela)}
                    className="border-b border-gray-800/50 hover:bg-gray-800/40 cursor-pointer"
                  >
                    <td className="py-2 px-3 text-purple-300 font-mono text-xs">{t.tabela}</td>
                    <td className="py-2 px-3 text-right text-white">{fmtNum(t.campos)}</td>
                    <td className="py-2 px-3 text-right text-gray-400">{fmtNum(t.descritos)}</td>
                    <td className="py-2 px-3 text-right text-indigo-300">{fmtNum(t.dominios)}</td>
                    <td className="py-2 px-3 text-right text-emerald-400">{fmtNum(t.fks)}</td>
                  </tr>
                ))}
                {filteredTables.length === 0 && (
                  <tr><td colSpan={5} className="text-center text-gray-600 py-6">Nenhuma tabela encontrada</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}