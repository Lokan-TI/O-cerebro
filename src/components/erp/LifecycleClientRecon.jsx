import { useState } from "react";
import { base44 } from "@/api/base44Client";
import LifecycleClientMatrix from "@/components/erp/LifecycleClientMatrix";
import LifecycleDivergenceTable from "@/components/erp/LifecycleDivergenceTable";
import { GitCompare, Loader2 } from "lucide-react";

const fmt = (v) => (Number(v) || 0).toLocaleString("pt-BR");
const fmtBRL = (v) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export default function LifecycleClientRecon({ sourceId, asOf }) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const run = async () => {
    setRunning(true); setError(null);
    try {
      const res = await base44.functions.invoke("reconcileLifecycle", { source_id: sourceId, as_of_date: asOf });
      if (res.data?.error) throw new Error(res.data.error);
      setData(res.data);
    } catch (e) { setError(e.message); }
    setRunning(false);
  };

  const s = data?.summary;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h4 className="text-sm font-semibold text-white">Reconciliação por cliente (doc 10 · passo 2)</h4>
          <p className="text-xs text-gray-500">Compara o estado de cada cliente nos dois motores no mesmo corte.</p>
        </div>
        <button
          onClick={run} disabled={running}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 disabled:opacity-50 rounded-lg text-gray-200 text-sm"
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitCompare className="w-4 h-4" />}
          Reconciliar por cliente
        </button>
      </div>

      {error && <div className="bg-red-950/50 border border-red-800 rounded-xl p-3 text-sm text-red-300">{error}</div>}

      {s && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
              <div className="text-xs text-gray-500">Clientes em comum</div>
              <div className="text-lg font-bold text-white">{fmt(s.matched)}</div>
            </div>
            <div className="bg-gray-900 border border-emerald-500/30 rounded-xl p-3">
              <div className="text-xs text-gray-500">Concordância</div>
              <div className="text-lg font-bold text-emerald-400">{s.agreement_pct}%</div>
              <div className="text-[11px] text-gray-500">{fmt(s.agree)} clientes</div>
            </div>
            <div className="bg-gray-900 border border-amber-500/30 rounded-xl p-3">
              <div className="text-xs text-gray-500">Divergentes</div>
              <div className="text-lg font-bold text-amber-400">{fmt(s.diverge)}</div>
              <div className="text-[11px] text-gray-500">{fmtBRL(s.divergence_revenue_12m)}</div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
              <div className="text-xs text-gray-500">Só no v1 (NF)</div>
              <div className="text-lg font-bold text-purple-300">{fmt(s.only_v1)}</div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
              <div className="text-xs text-gray-500">Só no legado</div>
              <div className="text-lg font-bold text-cyan-300">{fmt(s.only_legacy)}</div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
              <div className="text-xs text-gray-500">Universos</div>
              <div className="text-[11px] text-gray-400 mt-1">v1: {fmt(s.v1_clients)}</div>
              <div className="text-[11px] text-gray-400">legado: {fmt(s.legacy_clients)}</div>
            </div>
          </div>
          <LifecycleClientMatrix families={data.families} matrix={data.matrix} />
          <LifecycleDivergenceTable rows={data.top_divergences} />
        </>
      )}
    </div>
  );
}