import { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useErpSource, ALL_SOURCES_ID } from "@/lib/ErpSourceContext";
import { useBrainSnapshot } from "@/components/brain/useBrainSnapshot";
import { buildGrowthKpis } from "@/lib/growthKpis";
import DecisionSection from "@/components/decision/DecisionSection";
import QueryInspector from "@/components/erp/QueryInspector";
import { Loader2, Rocket, RefreshCw, AlertTriangle } from "lucide-react";

export default function GrowthMarketing() {
  const { selectedSource } = useErpSource();
  const { snapshot } = useBrainSnapshot();
  const [growth, setGrowth] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const sourceId =
    selectedSource?.id && selectedSource.id !== ALL_SOURCES_ID ? selectedSource.id : undefined;

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("analyzeGrowth", {
        ...(sourceId ? { source_id: sourceId } : {}),
      });
      if (res.data?.error) setError(res.data.error);
      else setGrowth(res.data);
    } catch (e) {
      setError("Não foi possível consultar o ERP agora. Detalhe: " + String(e?.message || e).slice(0, 200));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [sourceId]);

  const dept = useMemo(() => buildGrowthKpis(growth, snapshot), [growth, snapshot]);

  return (
    <div className="min-h-screen bg-gray-950 px-6 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 pr-14 flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Rocket className="w-5 h-5 text-purple-400" />
              <h1 className="text-2xl font-bold text-white">Growth Marketing</h1>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Demanda, ocupação real da frota e retenção de contas apurados direto no Sisloc
              {selectedSource?.name ? ` · base ${selectedSource.name}` : ""}
            </p>
            {growth?.period && (
              <p className="text-xs text-gray-500 mt-1">
                Janela: {growth.period.start} a {growth.period.end}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {growth?.queries && <QueryInspector queries={growth.queries} />}
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm rounded-lg px-4 py-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Atualizar do ERP
            </button>
          </div>
        </div>

        {error && (
          <div className="border border-red-700/50 bg-red-950/30 rounded-xl p-4 mb-6 text-sm text-red-300 flex gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
          </div>
        )}

        {growth?.warnings?.length > 0 && (
          <div className="border border-amber-700/50 bg-amber-950/20 rounded-xl p-4 mb-6 text-xs text-amber-300">
            Alguns indicadores não puderam ser apurados nesta consulta: {growth.warnings.join(" · ")}
          </div>
        )}

        {loading && !growth ? (
          <div className="flex items-center gap-2 text-gray-500 text-sm py-16">
            <Loader2 className="w-4 h-4 animate-spin" /> Apurando indicadores no ERP…
          </div>
        ) : !dept ? (
          <p className="text-gray-500 text-sm py-16">
            Nenhum dado disponível. Use “Atualizar do ERP” para apurar os indicadores.
          </p>
        ) : (
          <DecisionSection dept={dept} editing={false} hiddenIds={[]} onToggle={() => {}} />
        )}
      </div>
    </div>
  );
}