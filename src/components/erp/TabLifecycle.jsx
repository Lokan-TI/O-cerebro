import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useErpSource, ALL_SOURCES_ID } from "@/lib/ErpSourceContext";
import LifecycleFamilyCompare from "@/components/erp/LifecycleFamilyCompare";
import LifecycleClientRecon from "@/components/erp/LifecycleClientRecon";
import { HeartPulse, Play, Loader2 } from "lucide-react";

const STATUS_META = {
  REPEAT: { label: "Recorrente", cls: "text-emerald-400 border-emerald-500/30" },
  ACTIVE: { label: "Ativo", cls: "text-green-400 border-green-500/30" },
  REACTIVATED: { label: "Reativado", cls: "text-cyan-400 border-cyan-500/30" },
  AT_RISK: { label: "Em risco", cls: "text-amber-400 border-amber-500/30" },
  DORMANT: { label: "Dormente", cls: "text-orange-400 border-orange-500/30" },
  CHURNED: { label: "Churn", cls: "text-red-400 border-red-500/30" },
};

const fmtBRL = (v) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function minusDays(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export default function TabLifecycle() {
  const { selectedSource } = useErpSource();
  const sourceId = selectedSource && selectedSource.id !== ALL_SOURCES_ID ? selectedSource.id : null;
  const [asOf, setAsOf] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [v1, setV1] = useState(null);
  const [legacy, setLegacy] = useState(null);

  const run = async () => {
    setRunning(true); setError(null); setLegacy(null);
    try {
      const payload = { source_id: sourceId || undefined };
      if (asOf) payload.as_of_date = asOf;
      const res = await base44.functions.invoke("computeLifecycle", payload);
      if (res.data?.error) throw new Error(res.data.error);
      setV1(res.data);
      const cut = res.data.as_of_date;
      const leg = await base44.functions.invoke("classifyClientStatus", {
        source_id: res.data.source.id,
        analysis_start: minusDays(cut, 365),
        analysis_end: cut,
        ref_start: minusDays(cut, 730),
      });
      if (leg.data?.success) setLegacy(leg.data);
    } catch (e) {
      setError(e.message);
    }
    setRunning(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <HeartPulse className="w-5 h-5 text-purple-400" /> Customer Lifecycle v1 (paralelo)
          </h3>
          <p className="text-sm text-gray-500 max-w-2xl">
            Máquina de estados única (doc 10): atividade por NF emitida, corte explícito. Roda em paralelo ao motor
            legado por remessa, sem alterar as telas atuais.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Data de corte (as_of)</label>
            <input
              type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)}
              className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200"
            />
          </div>
          <button
            onClick={run} disabled={running}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-lg text-white text-sm font-medium"
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Executar em paralelo
          </button>
        </div>
      </div>

      {error && <div className="bg-red-950/50 border border-red-800 rounded-xl p-3 text-sm text-red-300">{error}</div>}

      {v1 && (
        <>
          <div className="text-xs text-gray-500">
            Versão <span className="text-gray-300">{v1.lifecycle_version}</span> · corte{" "}
            <span className="text-gray-300">{v1.as_of_date}</span> · universo: {v1.universe} ·{" "}
            {Number(v1.total_clients).toLocaleString("pt-BR")} clientes
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {(v1.distribution || []).map((d) => {
              const m = STATUS_META[d.status] || { label: d.status, cls: "text-gray-300 border-gray-700" };
              return (
                <div key={d.status} className={`bg-gray-900 border rounded-xl p-3 ${m.cls}`}>
                  <div className="text-xs text-gray-500">{m.label}</div>
                  <div className="text-xl font-bold">{Number(d.count).toLocaleString("pt-BR")}</div>
                  <div className="text-[11px] text-gray-500">Receita 12m: {fmtBRL(d.revenue_12m)}</div>
                </div>
              );
            })}
          </div>
          {legacy ? (
            <LifecycleFamilyCompare v1Distribution={v1.distribution} legacyDistribution={legacy.distribution} />
          ) : (
            running ? null : <div className="text-xs text-gray-500">Motor legado não retornou — paralelo indisponível nesta execução.</div>
          )}
          <LifecycleClientRecon sourceId={v1.source.id} asOf={v1.as_of_date} />
        </>
      )}
    </div>
  );
}