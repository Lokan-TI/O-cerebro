import { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useErpSource, ALL_SOURCES_ID } from "@/lib/ErpSourceContext";
import { summarizeCap, ownershipRanking, familyCompare } from "@/lib/capexOpex";
import AtivosKpiCards from "@/components/ativos/AtivosKpiCards";
import AtivosHierarquia from "@/components/ativos/AtivosHierarquia";
import FamiliaComparativo from "@/components/ativos/FamiliaComparativo";
import CapexOpexPanel from "@/components/ativos/CapexOpexPanel";
import QueryInspector from "@/components/erp/QueryInspector";
import { RefreshCw, Boxes, AlertTriangle } from "lucide-react";

export default function AtivosCustos() {
  const { selectedSource } = useErpSource();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const sourceId =
    selectedSource?.id && selectedSource.id !== ALL_SOURCES_ID ? selectedSource.id : undefined;

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("analyzeCapexOpex", {
        ...(sourceId ? { source_id: sourceId } : {}),
      });
      if (res.data?.error) setError(res.data.error);
      else setData(res.data);
    } catch (e) {
      setError("Não foi possível consultar o ERP agora. Detalhe: " + String(e?.message || e).slice(0, 200));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [sourceId]);

  const ranking = useMemo(() => (data ? ownershipRanking(data.grupos) : []), [data]);
  const cap = useMemo(() => (data ? summarizeCap(data.cap) : null), [data]);
  const compare = useMemo(() => familyCompare(ranking), [ranking]);

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Boxes className="w-6 h-6 text-purple-400" /> Ativos, CAPEX e OPEX
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Base completa de ativos da empresa, custo de posse por família e todos os custos pagos nos últimos 12
            meses separados em investimento e operação.
          </p>
          {data?.period && (
            <p className="text-xs text-gray-500 mt-1">
              Janela de custos: {data.period.start} a {data.period.end}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {data?.queries && <QueryInspector queries={data.queries} />}
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
        <div className="border border-red-700/50 bg-red-950/30 rounded-xl p-4 text-sm text-red-300 flex gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {loading && !data && (
        <div className="text-gray-500 text-center py-16">Levantando ativos, manutenções e contas pagas…</div>
      )}

      {data && (
        <>
          <AtivosKpiCards grupos={data.grupos} ranking={ranking} cap={cap} />
          <FamiliaComparativo compare={compare} />
          <AtivosHierarquia ranking={ranking} />
          <CapexOpexPanel cap={cap} />
        </>
      )}
    </div>
  );
}