import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useErpSource, ALL_SOURCES_ID } from "@/lib/ErpSourceContext";
import CapContaGroup from "@/components/erp/CapContaGroup";
import { fmtCur, fmtNum } from "@/lib/erpFormat";
import { Loader2, AlertTriangle, RefreshCw, Search, Database } from "lucide-react";

// Sub-aba "CAP por conta" — consulta ao vivo agrupada pelo plano financeiro,
// com status oficiais do título (aberto, vencido, provisório, baixado, cancelado).
export default function CapPorContaTab({ dateRange }) {
  const { selectedSource } = useErpSource();
  const sourceId = selectedSource && selectedSource.id !== ALL_SOURCES_ID ? selectedSource.id : undefined;

  const [start, setStart] = useState(dateRange?.start || "2013-01-01");
  const [end, setEnd] = useState(dateRange?.end || new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [q, setQ] = useState("");

  const carregar = async (s = start, e = end) => {
    setLoading(true); setError(null);
    try {
      const res = await base44.functions.invoke("listCapPorConta", {
        source_id: sourceId, start_date: s, end_date: e,
      });
      if (!res?.data?.success) throw new Error(res?.data?.error || "Falha na consulta");
      setRows(res.data.rows || []);
    } catch (err) {
      setError(err?.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, [sourceId]); // eslint-disable-line react-hooks/exhaustive-deps

  const { groups, totals } = useMemo(() => buildGroups(rows, q), [rows, q]);

  return (
    <div className="space-y-4">
      {/* Controles */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Emissão de</label>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} disabled={loading} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">até</label>
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} disabled={loading} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
        </div>
        <button onClick={() => carregar()} disabled={loading} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Consultar
        </button>
        <div className="relative ml-auto">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar conta…" className="bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white w-56" />
        </div>
      </div>

      {error && (
        <div className="bg-red-950/40 border border-red-800/50 rounded-lg px-4 py-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span className="text-red-300 text-xs">{error}</span>
        </div>
      )}

      {loading && !rows && (
        <div className="text-gray-500 p-8 text-center flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Consultando o banco…
        </div>
      )}

      {rows && (
        <>
          {/* KPIs por status */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <Kpi label="Total lançado" value={fmtCur(totals.vl_total)} sub={`${fmtNum(totals.qtd)} títulos · exclui cancelados`} color="text-white" />
            <Kpi label="Em aberto" value={fmtCur(totals.vl_aberto)} sub={`Vencido: ${fmtCur(totals.vl_vencido)}`} color="text-amber-400" />
            <Kpi label="Provisório" value={fmtCur(totals.vl_provisorio)} sub="Status 5 no Sisloc" color="text-blue-400" />
            <Kpi label="Baixado" value={fmtCur(totals.vl_baixado)} sub="Pagamentos efetivados" color="text-green-400" />
            <Kpi label="Cancelado" value={fmtCur(totals.vl_cancelado)} sub={`${fmtNum(totals.qtd_cancelado)} títulos · fora do total`} color="text-gray-400" />
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Database className="w-3.5 h-3.5" />
            Consulta ao vivo no plano financeiro do Sisloc — CAP não possui dimensão de empresa (visão consolidada).
          </div>

          {groups.map((g) => (
            <CapContaGroup key={g.key} group={g} grandTotal={totals.vl_total} />
          ))}
          {groups.length === 0 && <div className="text-gray-600 text-center py-8 text-sm">Nenhuma conta encontrada para o filtro.</div>}
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, sub, color }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="text-xs text-gray-500 uppercase mb-1">{label}</div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-600 mt-1">{sub}</div>
    </div>
  );
}

// Agrupa contas pelo 1º dígito do nr_planfin (1 = Entradas, 2 = Saídas).
function buildGroups(rows, q) {
  const empty = { qtd: 0, qtd_cancelado: 0, vl_total: 0, vl_aberto: 0, vl_vencido: 0, vl_provisorio: 0, vl_baixado: 0, vl_cancelado: 0 };
  const totals = { ...empty };
  if (!rows) return { groups: [], totals };

  const term = q.trim().toLowerCase();
  const map = new Map();
  for (const r of rows) {
    for (const k of Object.keys(empty)) totals[k] += Number(r[k]) || 0;
    if (term && !(`${r.ds_planfin} ${r.nr_planfin}`.toLowerCase().includes(term))) continue;
    const first = (r.nr_planfin || "")[0];
    const key = first === "1" ? "entradas" : first === "2" ? "saidas" : "sem_conta";
    if (!map.has(key)) {
      map.set(key, {
        key,
        label: key === "entradas" ? "Entradas (estornos e transferências)" : key === "saidas" ? "Saídas (despesas)" : "Sem conta vinculada",
        rows: [], subtotal: { ...empty },
      });
    }
    const g = map.get(key);
    g.rows.push(r);
    for (const k of Object.keys(empty)) g.subtotal[k] += Number(r[k]) || 0;
  }
  const order = ["saidas", "entradas", "sem_conta"];
  return { groups: order.map((k) => map.get(k)).filter(Boolean), totals };
}