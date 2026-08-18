import { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useErpSource, ALL_SOURCES_ID } from "@/lib/ErpSourceContext";
import {
  computeKpis, defaultAssumptions, projectScenarios, projectionSummary,
} from "@/lib/longTermProjection";
import ProjectionKpiCards from "@/components/projecao/ProjectionKpiCards";
import ProjectionAssumptions from "@/components/projecao/ProjectionAssumptions";
import ProjectionChart from "@/components/projecao/ProjectionChart";
import ProjectionSummary from "@/components/projecao/ProjectionSummary";
import ProjectionTable from "@/components/projecao/ProjectionTable";
import AssetInvestmentPanel from "@/components/projecao/AssetInvestmentPanel";
import QueryInspector from "@/components/erp/QueryInspector";
import { RefreshCw, LineChart, AlertTriangle } from "lucide-react";

export default function ProjecaoLongoPrazo() {
  const { selectedSource } = useErpSource();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [assumptions, setAssumptions] = useState(null);

  const sourceId = selectedSource?.id && selectedSource.id !== ALL_SOURCES_ID ? selectedSource.id : undefined;

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("projectLongTermRevenue", {
        years: 10,
        ...(sourceId ? { source_id: sourceId } : {}),
      });
      if (res.data?.error) setError(res.data.error);
      else {
        setData(res.data);
        setAssumptions(defaultAssumptions(computeKpis(res.data)));
      }
    } catch (e) {
      setError(
        "Não foi possível consultar o ERP agora (a consulta demorou demais ou a conexão foi recusada). Tente recarregar em alguns instantes. Detalhe: " +
        String(e?.message || e).slice(0, 200)
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [sourceId]);

  const kpis = useMemo(() => (data ? computeKpis(data) : null), [data]);
  const rows = useMemo(
    () => (kpis && assumptions ? projectScenarios(kpis, assumptions) : []),
    [kpis, assumptions]
  );
  const summary = useMemo(() => projectionSummary(kpis, rows), [kpis, rows]);

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <LineChart className="w-6 h-6 text-purple-400" /> Previsibilidade de receita — longo prazo
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Histórico de crescimento, compras de ativos e KPIs de mercado de locação projetados para os próximos
            {" "}{assumptions?.horizonte || 10} anos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {data?.queries && <QueryInspector queries={data.queries} />}
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm rounded-lg px-4 py-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Recarregar dados
          </button>
        </div>
      </div>

      {error && (
        <div className="border border-red-700/50 bg-red-950/30 rounded-xl p-4 text-sm text-red-300 flex gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {loading && !data && (
        <div className="text-gray-500 text-center py-16">Consultando histórico de receita e frota…</div>
      )}

      {kpis && assumptions && (
        <>
          <ProjectionKpiCards kpis={kpis} />
          <ProjectionAssumptions
            assumptions={assumptions}
            onChange={setAssumptions}
            onReset={() => setAssumptions(defaultAssumptions(kpis))}
          />
          <ProjectionSummary kpis={kpis} summary={summary} />
          <ProjectionChart kpis={kpis} rows={rows} />
          <AssetInvestmentPanel kpis={kpis} fleet={data.fleet} />
          <ProjectionTable rows={rows} />
        </>
      )}
    </div>
  );
}