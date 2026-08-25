import { useState, useMemo, useEffect, useRef } from "react";
import { useErpSource, ALL_SOURCES_ID } from "@/lib/ErpSourceContext";
import { useEmpresaFilter } from "@/lib/EmpresaFilterContext";
import { useGlobalFilter } from "@/lib/GlobalFilterContext";
import { fmtCur, fmtNum } from "@/lib/erpFormat";
import { fetchClientesAtivos, invalidateClientesAtivos } from "@/components/erp/clientesAtivosCache";
import { exportClientesAtivosCsv } from "@/components/erp/clientesAtivosExport";
import QueryInspector from "@/components/erp/QueryInspector";
import { Users, Download, RefreshCw, Search, Repeat } from "lucide-react";

// Listagem completa (sem corte de top N) de clientes ativos por empresa Sisloc,
// consultada ao vivo no ERP e exportável em Excel.
export default function ClientesAtivosTable({ onSelectClient }) {
  const { selectedSource } = useErpSource();
  const { selectedEmpresa } = useEmpresaFilter();
  const { period } = useGlobalFilter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [start, setStart] = useState(period.start);
  const [end, setEnd] = useState(period.end);
  const [limit, setLimit] = useState(300);
  const loadedRange = useRef(null);

  // O período do filtro global define a janela inicial; o usuário ainda pode
  // ajustar data a data aqui — a consulta é refeita automaticamente.
  useEffect(() => {
    setStart(period.start);
    setEnd(period.end);
  }, [period.start, period.end]);

  // Carrega automaticamente ao abrir — os KPIs e a tabela usam a mesma consulta.
  useEffect(() => {
    if (!loadedRange.current) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Depois da primeira consulta, qualquer mudança de data recarrega o ERP
  // (antes as datas só tinham efeito se o usuário clicasse em "Recarregar").
  useEffect(() => {
    if (!loadedRange.current) return;
    if (loadedRange.current === `${start}|${end}`) return;
    const t = setTimeout(() => { load(); }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end, selectedSource?.id]);

  const load = async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      if (force) invalidateClientesAtivos();
      const sourceId = selectedSource?.id && selectedSource.id !== ALL_SOURCES_ID ? selectedSource.id : null;
      const result = await fetchClientesAtivos(sourceId, start, end);
      setData(result);
      loadedRange.current = `${start}|${end}`;
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Falha ao carregar clientes");
    } finally {
      setLoading(false);
    }
  };

  const rows = useMemo(() => {
    let list = data?.rows || [];
    if (selectedEmpresa != null) list = list.filter((r) => Number(r.cd_empresa) === Number(selectedEmpresa));
    const totalRev = list.reduce((s, r) => s + r.receita, 0);
    list = list.map((r) => ({ ...r, share: totalRev > 0 ? (r.receita / totalRev) * 100 : 0 }));
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((r) => r.nm_pessoa.toLowerCase().includes(q) || String(r.cd_pessoa).includes(q) || r.nm_empresa.toLowerCase().includes(q));
    return list;
  }, [data, selectedEmpresa, search]);

  const totals = useMemo(
    () => rows.reduce((t, r) => ({ receita: t.receita + r.receita, nfs: t.nfs + r.nfs, ativos: t.ativos + r.contratos_ativos }), { receita: 0, nfs: 0, ativos: 0 }),
    [rows]
  );

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-white font-semibold text-sm flex items-center gap-2">
          <Users className="w-4 h-4 text-purple-400" /> Todos os clientes ativos
          {data && <span className="text-gray-500 font-normal">· {fmtNum(rows.length)} clientes · {fmtCur(totals.receita)} atribuídos · {start} → {end}</span>}
        </h3>
        <div className="flex items-center gap-2">
          <QueryInspector queries={data?.sql ? [data.sql, data.fiscal_sql].filter(Boolean) : null} title="Queries — Clientes ativos e total fiscal" />
          <button onClick={() => load(true)} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-lg text-white text-xs font-medium">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            {data ? "Recarregar" : "Carregar clientes"}
          </button>
          {data && (
            <button onClick={() => exportClientesAtivosCsv(rows)} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 rounded-lg text-white text-xs font-medium">
              <Download className="w-3.5 h-3.5" /> Exportar Excel
            </button>
          )}
        </div>
      </div>

      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Receita de</label>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">até</label>
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200" />
        </div>
        <div className="relative">
          <Search className="w-4 h-4 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente ou empresa…" className="pl-8 pr-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white w-64 focus:outline-none focus:border-purple-500" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Linhas exibidas</label>
          <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200">
            <option value={300}>300</option>
            <option value={1000}>1.000</option>
            <option value={5000}>5.000</option>
            <option value={999999}>Todas</option>
          </select>
        </div>
      </div>

      {error && <div className="bg-red-950/40 border border-red-800/50 rounded-lg px-4 py-2 text-red-300 text-sm">{error}</div>}
      {!data && !loading && !error && (
        <div className="text-gray-500 p-8 text-center border border-dashed border-gray-800 rounded-xl">
          Clique em "Carregar clientes" para consultar todos os clientes ativos do sistema no período.
        </div>
      )}
      {loading && <div className="text-gray-500 p-8 text-center">Consultando clientes no ERP…</div>}

      {data && (
        <>
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-900">
                <tr className="text-gray-500 text-xs uppercase border-b border-gray-800">
                  <th className="text-left py-2 px-3">#</th>
                  <th className="text-left py-2 px-3">Cliente</th>
                  <th className="text-left py-2 px-3">Empresa Sisloc</th>
                  <th className="text-right py-2 px-3">Faturamento atribuído</th>
                  <th className="text-right py-2 px-3">%</th>
                  <th className="text-right py-2 px-3">NFs</th>
                  <th className="text-right py-2 px-3">Última NF</th>
                  <th className="text-right py-2 px-3">Contratos ativos</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, limit).map((r, i) => (
                  <tr
                    key={`${r.cd_empresa}-${r.cd_pessoa}-${i}`}
                    onClick={() => onSelectClient?.({ cd_pessoa: r.cd_pessoa, nm_pessoa: r.nm_pessoa, receita: r.receita, nfs: r.nfs })}
                    className="border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer"
                  >
                    <td className="py-2 px-3 text-gray-500">{i + 1}</td>
                    <td className="py-2 px-3 text-white">
                      <div className="truncate max-w-[260px]">{r.nm_pessoa}</div>
                      <div className="text-xs text-gray-600">#{r.cd_pessoa}</div>
                    </td>
                    <td className="py-2 px-3 text-gray-300 text-xs">
                      <div className="truncate max-w-[220px]">{r.nm_empresa}</div>
                      <div className="text-gray-600">#{r.cd_empresa}</div>
                    </td>
                    <td className="py-2 px-3 text-right text-green-400 font-medium">{fmtCur(r.receita)}</td>
                    <td className="py-2 px-3 text-right text-gray-400">{r.share.toFixed(1)}%</td>
                    <td className="py-2 px-3 text-right text-gray-300">{fmtNum(r.nfs)}</td>
                    <td className="py-2 px-3 text-right text-gray-400 text-xs">{r.ultima_nf || "—"}</td>
                    <td className="py-2 px-3 text-right">
                      <span className="inline-flex items-center gap-1 text-purple-400">
                        <Repeat className="w-3 h-3" />
                        {fmtNum(r.contratos_ativos)}
                        <span className="text-gray-600 text-xs">/{fmtNum(r.contratos_total)}</span>
                      </span>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={8} className="text-center text-gray-600 py-6">Nenhum cliente encontrado</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="text-xs text-gray-600">
            Total fiscal do período: <span className="text-gray-400">{fmtCur(selectedEmpresa == null ? data.faturamento_fiscal_total : (data.fiscal_by_empresa || []).find((r) => Number(r.cd_empresa) === Number(selectedEmpresa))?.faturamento_fiscal || 0)}</span>
            {" · "}Sem cliente identificado: <span className="text-amber-500">{fmtCur(selectedEmpresa == null ? data.faturamento_sem_cliente : (data.fiscal_by_empresa || []).find((r) => Number(r.cd_empresa) === Number(selectedEmpresa))?.faturamento_sem_cliente || 0)}</span>.
            <br />
            {rows.length > limit
              ? `Exibindo ${fmtNum(limit)} de ${fmtNum(rows.length)} — a exportação inclui todos os ${fmtNum(rows.length)} clientes filtrados.`
              : `Todos os ${fmtNum(rows.length)} clientes do período estão listados.`}
            {" "}Linha = empresa Sisloc × cliente · {fmtNum(totals.nfs)} NFs · {fmtNum(totals.ativos)} contratos ativos.
          </div>
        </>
      )}
    </div>
  );
}