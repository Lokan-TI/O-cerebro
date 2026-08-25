import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useErpSource, ALL_SOURCES_ID } from "@/lib/ErpSourceContext";
import { getEmpresaLabel } from "@/lib/empresaLabels";
import { toExclusiveEnd } from "@/lib/periodContract";
import ExportColumnPicker from "@/components/erp/ExportColumnPicker";
import { downloadFinCsv } from "@/components/erp/finExportCsv";
import { Download, Search, Loader2, AlertTriangle } from "lucide-react";

const DEFAULTS = {
  car: ["cd_lan", "dt_emi_car", "dt_ven_car", "dt_bai_car", "vl_pre_car", "vl_acr_car", "vl_des_car", "tp_car", "nr_docto_ori", "rel_cliente_nome", "rel_cliente_cnpj", "rel_empresa_nome", "rel_conta_descricao", "rel_tipo_cobranca"],
  cap: ["cd_lan", "dt_emi_cap", "dt_ven_cap", "dt_bai_cap", "vl_pre_cap", "vl_acr_cap", "vl_des_cap", "tp_cap", "nr_boleto", "rel_credor_nome", "rel_credor_cnpj", "rel_conta_descricao", "rel_tipo_cobranca"],
};

export default function FinanceiroExportTab({ empresas = [] }) {
  const { selectedSource } = useErpSource();
  const sourceId = selectedSource && selectedSource.id !== ALL_SOURCES_ID ? selectedSource.id : undefined;

  const year = new Date().getFullYear();
  const [doc, setDoc] = useState("car");
  const [start, setStart] = useState(`${year}-01-01`);
  const [end, setEnd] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState("todos");
  const [empresa, setEmpresa] = useState("");
  const [catalog, setCatalog] = useState(null);
  const [selected, setSelected] = useState(new Set(DEFAULTS.car));
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setCatalog(null);
    base44.functions.invoke("exportFinanceiro", { mode: "columns", doc }).then((res) => {
      if (!alive) return;
      if (res?.data?.success) {
        setCatalog(res.data.catalog);
        setSelected(new Set(DEFAULTS[doc]));
        setRows(null);
        setError(null);
      }
    }).catch((e) => alive && setError(e?.response?.data?.error || e.message));
    return () => { alive = false; };
  }, [doc]);

  const toggle = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const setGroup = useCallback((ids, on) => {
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    setRows(null);
    try {
      const res = await base44.functions.invoke("exportFinanceiro", {
        source_id: sourceId,
        doc,
        columns: [...selected],
        start_date: start,
        end_date: end,
        end_date_exclusive: toExclusiveEnd(end),
        status,
        cd_empresa: doc === "car" ? empresa : undefined,
        limit: 10000,
      });
      if (!res?.data?.success) throw new Error(res?.data?.error || "Falha na extração");
      setRows(res.data.rows || []);
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  const orderedCols = catalog
    ? [...catalog.base, ...catalog.related].filter((c) => selected.has(c.id))
    : [];

  const exportCsv = () => downloadFinCsv({ doc, columns: orderedCols, rows: rows || [] });

  return (
    <div className="space-y-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Documento</label>
            <select value={doc} onChange={(e) => setDoc(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
              <option value="car">CAR — Contas a Receber</option>
              <option value="cap">CAP — Contas a Pagar</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Emissão de</label>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">até</label>
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Situação</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
              <option value="todos">Todos</option>
              <option value="aberto">Em aberto</option>
              <option value="baixado">Baixados</option>
              <option value="vencido">Vencidos</option>
              {doc === "car" && <option value="cancelado">Cancelados</option>}
            </select>
          </div>
          {doc === "car" && (
            <div>
              <label className="text-xs text-gray-500 block mb-1">Empresa gestora</label>
              <select value={empresa} onChange={(e) => setEmpresa(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
                <option value="">Todas</option>
                {empresas.map((cd) => (
                  <option key={cd} value={cd}>{getEmpresaLabel(cd)}</option>
                ))}
              </select>
            </div>
          )}
          <button
            onClick={fetchData}
            disabled={loading || !catalog || selected.size === 0}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Buscar dados
          </button>
          {rows && rows.length > 0 && (
            <button onClick={exportCsv} className="flex items-center gap-2 bg-green-700 hover:bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-lg">
              <Download className="w-4 h-4" /> Baixar CSV ({rows.length.toLocaleString("pt-BR")})
            </button>
          )}
        </div>
        <p className="text-xs text-gray-600">
          Extração limitada a 10.000 títulos por vez, ordenados pela emissão mais recente. CAP não possui dimensão de empresa no SISLOC.
        </p>
      </div>

      {error && (
        <div className="bg-red-950/40 border border-red-800/50 rounded-lg px-4 py-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span className="text-red-300 text-xs">{error}</span>
        </div>
      )}

      {!catalog ? (
        <div className="text-gray-500 text-sm p-4">Carregando colunas do dicionário…</div>
      ) : (
        <ExportColumnPicker catalog={catalog} selected={selected} onToggle={toggle} onSetGroup={setGroup} />
      )}

      {rows && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-xs text-gray-400 mb-3">
            {rows.length === 0 ? "Nenhum título encontrado para os filtros." : `${rows.length.toLocaleString("pt-BR")} títulos — prévia dos 20 primeiros`}
          </div>
          {rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 uppercase border-b border-gray-800">
                    {orderedCols.map((c) => <th key={c.id} className="text-left py-2 px-2 whitespace-nowrap">{c.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 20).map((r, i) => (
                    <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      {orderedCols.map((c) => (
                        <td key={c.id} className="py-1.5 px-2 text-gray-300 whitespace-nowrap max-w-[220px] truncate">
                          {r[c.id] == null ? "—" : String(r[c.id]).replace("T", " ").slice(0, 19)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}