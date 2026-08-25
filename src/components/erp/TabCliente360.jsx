import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useErpSource } from "@/lib/ErpSourceContext";
import { useGlobalFilter } from "@/lib/GlobalFilterContext";
import { RefreshCw, Database, AlertTriangle } from "lucide-react";
import { toInclusiveEnd } from "@/lib/periodContract";
import Cliente360Kpis from "./Cliente360Kpis";
import Cliente360Table from "./Cliente360Table";

const brl = (v) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export default function TabCliente360() {
  const { selectedSource } = useErpSource();
  const { period } = useGlobalFilter();
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!selectedSource) return;
    setLoading(true);
    const list = await base44.entities.ClienteDimSnapshot.filter(
      { source_id: selectedSource.id, is_current: true }, "-created_at", 1
    );
    setSnapshot(list?.[0] || null);
    setLoading(false);
  }, [selectedSource]);

  useEffect(() => { load(); }, [load]);

  const refresh = async () => {
    if (!selectedSource) return;
    setRefreshing(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("refreshClienteDim", {
        source_id: selectedSource.id,
        start_date: period.start,
        end_date: period.endExclusive,
      });
      const result = res?.data || res;
      if (!result?.success) setError(result?.error || "Falha ao atualizar a camada de clientes.");
      else await load();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-white font-semibold flex items-center gap-2">
            <Database className="w-4 h-4 text-purple-400" /> Cliente 360
          </h2>
          <p className="text-gray-500 text-xs mt-0.5">
            {snapshot
              ? `Versão ${snapshot.version} · período ${snapshot.period_start} → ${toInclusiveEnd(snapshot.period_end)} · ${snapshot.query_count} consultas`
              : "Nenhuma versão publicada para esta fonte."}
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing || !selectedSource}
          className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          Atualizar dados
        </button>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-300 text-sm">{error}</div>
      )}

      {snapshot && (snapshot.period_start !== period.start || snapshot.period_end !== period.endExclusive) && (
        <div className="bg-amber-900/20 border border-amber-800 rounded-lg p-3 text-amber-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Esta versão foi calculada de {snapshot.period_start} a {toInclusiveEnd(snapshot.period_end)}, diferente do filtro global
          ({period.start} → {period.end}). Clique em “Atualizar dados” para recalcular no período selecionado.
        </div>
      )}

      {loading || refreshing ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl py-16 text-center">
          <div className="w-8 h-8 border-4 border-gray-700 border-t-purple-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">{refreshing ? "Consolidando a camada canônica de clientes..." : "Carregando..."}</p>
        </div>
      ) : !snapshot ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl py-16 text-center text-gray-500 text-sm">
          Clique em “Atualizar dados” para gerar a primeira versão da camada Cliente 360.
        </div>
      ) : (
        <>
          <Cliente360Kpis k={snapshot.kpis} />

          {(snapshot.by_empresa || []).length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800 text-white text-sm font-medium">Por empresa</div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-800/50 text-gray-400 text-xs uppercase tracking-wide">
                    <th className="text-left px-4 py-2">Empresa</th>
                    <th className="text-center px-4 py-2">Clientes</th>
                    <th className="text-center px-4 py-2">Ativos</th>
                    <th className="text-right px-4 py-2">Faturamento</th>
                    <th className="text-right px-4 py-2">CAR aberto</th>
                    <th className="text-right px-4 py-2">CAR vencido</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.by_empresa.map((e) => (
                    <tr key={String(e.cd_empresa)} className="border-t border-gray-800">
                      <td className="px-4 py-2 text-white">{e.empresa_nome || `Empresa ${e.cd_empresa}`}</td>
                      <td className="px-4 py-2 text-center text-gray-300">{e.clientes}</td>
                      <td className="px-4 py-2 text-center text-green-400">{e.ativos}</td>
                      <td className="px-4 py-2 text-right text-white">{brl(e.faturamento)}</td>
                      <td className="px-4 py-2 text-right text-purple-300">{brl(e.car_aberto)}</td>
                      <td className="px-4 py-2 text-right text-amber-400">{brl(e.car_vencido)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Cliente360Table clients={snapshot.clients || []} truncated={snapshot.clients_truncated} />

          {(snapshot.warnings || []).length > 0 && (
            <div className="bg-amber-900/20 border border-amber-800 rounded-lg p-3 text-amber-300 text-xs space-y-1">
              {snapshot.warnings.map((w, i) => <p key={i}>{w}</p>)}
            </div>
          )}
        </>
      )}
    </div>
  );
}