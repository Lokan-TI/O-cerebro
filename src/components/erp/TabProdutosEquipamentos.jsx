import { useState, useMemo, Fragment } from "react";
import { base44 } from "@/api/base44Client";
import { useErpSource, ALL_SOURCES_ID } from "@/lib/ErpSourceContext";
import { fmtNum } from "@/lib/erpFormat";
import { exportEquipamentosCsv } from "@/components/erp/equipamentosExport";
import QueryInspector from "@/components/erp/QueryInspector";
import { Wrench, RefreshCw, Download, Search, ChevronRight, ChevronDown } from "lucide-react";

export default function TabProdutosEquipamentos() {
  const { selectedSource } = useErpSource();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [onlyWithPat, setOnlyWithPat] = useState(true);
  const [expanded, setExpanded] = useState({});

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = {};
      if (selectedSource?.id && selectedSource.id !== ALL_SOURCES_ID) payload.source_id = selectedSource.id;
      const res = await base44.functions.invoke("listEquipamentos", payload);
      setData(res.data);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Falha ao carregar equipamentos");
    } finally {
      setLoading(false);
    }
  };

  const rows = useMemo(() => {
    let list = data?.equipamentos || [];
    if (onlyWithPat) list = list.filter((e) => e.qtd_patrimonios > 0);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (e) =>
          e.nm_equipto.toLowerCase().includes(q) ||
          String(e.cd_equipto).includes(q) ||
          e.patrimonios.some((p) => p.nr_patrimonio.toLowerCase().includes(q) || p.nr_serie.toLowerCase().includes(q))
      );
    }
    return list;
  }, [data, search, onlyWithPat]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm text-gray-400 flex items-center gap-2">
          <Wrench className="w-4 h-4 text-purple-400" />
          Produtos/equipamentos cadastrados e os números de patrimônio vinculados
          {data && (
            <span className="text-gray-600">
              · {fmtNum(data.total_equipamentos)} produtos · {fmtNum(data.total_patrimonios)} patrimônios
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <QueryInspector queries={data?.queries} title="Queries — Produtos & Equipamentos" />
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-lg text-white text-xs font-medium"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            {data ? "Recarregar" : "Carregar equipamentos"}
          </button>
          {data && (
            <button
              onClick={() => exportEquipamentosCsv(rows)}
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
          Clique em "Carregar equipamentos" para consultar o cadastro de produtos e patrimônios no ERP.
        </div>
      )}
      {loading && <div className="text-gray-500 p-8 text-center">Consultando cadastro de equipamentos no ERP…</div>}

      {data && (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar produto, código, patrimônio ou série…"
                className="pl-8 pr-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white w-80 focus:outline-none focus:border-purple-500"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
              <input type="checkbox" checked={onlyWithPat} onChange={(e) => setOnlyWithPat(e.target.checked)} className="accent-purple-600" />
              Somente com patrimônio vinculado
            </label>
            <span className="text-xs text-gray-600">{fmtNum(rows.length)} exibidos</span>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs uppercase border-b border-gray-800">
                  <th className="text-left py-2 px-3 w-10"></th>
                  <th className="text-left py-2 px-3">Código</th>
                  <th className="text-left py-2 px-3">Descrição</th>
                  <th className="text-right py-2 px-3">Patrimônios</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 400).map((e) => {
                  const open = !!expanded[e.cd_equipto];
                  return (
                    <Fragment key={e.cd_equipto}>
                      <tr
                        onClick={() => setExpanded((s) => ({ ...s, [e.cd_equipto]: !open }))}
                        className="border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer"
                      >
                        <td className="py-2 px-3 text-gray-500">
                          {e.qtd_patrimonios > 0 ? (open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />) : null}
                        </td>
                        <td className="py-2 px-3 text-gray-500 font-mono text-xs">{e.cd_equipto}</td>
                        <td className="py-2 px-3 text-white">{e.nm_equipto || "—"}</td>
                        <td className="py-2 px-3 text-right text-purple-400 font-medium">{fmtNum(e.qtd_patrimonios)}</td>
                      </tr>
                      {open && e.qtd_patrimonios > 0 && (
                        <tr className="border-b border-gray-800/50 bg-gray-950/60">
                          <td></td>
                          <td colSpan={3} className="py-2 px-3">
                            <div className="flex flex-wrap gap-2">
                              {e.patrimonios.map((p) => (
                                <span key={p.cd_patrimonio} className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-gray-300 font-mono">
                                  {p.nr_patrimonio}
                                  {p.nr_serie && <span className="text-gray-500"> · série {p.nr_serie}</span>}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                      </Fragment>
                      );
                })}
                {rows.length === 0 && <tr><td colSpan={4} className="text-center text-gray-600 py-6">Nenhum produto encontrado</td></tr>}
              </tbody>
            </table>
            {rows.length > 400 && (
              <div className="text-xs text-gray-600 px-3 py-2 border-t border-gray-800">
                Exibindo os primeiros 400 — a exportação inclui todos os {fmtNum(rows.length)} produtos filtrados.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}