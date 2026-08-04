import { useState } from "react";
import { useErpSnapshot } from "@/lib/ErpSnapshotContext";
import { useErpSource } from "@/lib/ErpSourceContext";
import DataSourceDropdown from "./DataSourceDropdown";
import SyncConfirmDialog from "./SyncConfirmDialog";
import SyncHistoryPanel from "./SyncHistoryPanel";
import { RefreshCw, History, AlertTriangle, CheckCircle2, Loader2, Clock, Database } from "lucide-react";
import { formatDateTime, formatDuration, daysSince } from "@/lib/erpSync";

export default function RefreshHeader() {
  const { snapshot, latestRun, refreshing, refresh } = useErpSnapshot();
  const { selectedSource } = useErpSource();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const lastUpdate = latestRun?.completed_at || snapshot?.created_at;
  const status = latestRun?.status || (snapshot ? "stale" : "empty");
  const staleDays = daysSince(snapshot?.created_at);
  const stale = staleDays != null && staleDays >= 3;

  const statusConfig = {
    success: { icon: CheckCircle2, color: "text-green-400", bg: "bg-green-950 border-green-800", label: "Dados atualizados" },
    partial: { icon: AlertTriangle, color: "text-yellow-400", bg: "bg-yellow-950 border-yellow-800", label: "Atualizado com ressalvas" },
    failed: { icon: AlertTriangle, color: "text-red-400", bg: "bg-red-950 border-red-800", label: "Falha na última atualização" },
    running: { icon: Loader2, color: "text-blue-400", bg: "bg-blue-950 border-blue-800", label: "Atualização em andamento" },
    stale: { icon: Clock, color: "text-gray-400", bg: "bg-gray-800 border-gray-700", label: "Versão válida" },
    empty: { icon: Database, color: "text-gray-500", bg: "bg-gray-800 border-gray-700", label: "Sem dados — atualize para carregar" },
  };
  const cfg = statusConfig[status] || statusConfig.empty;
  const StatusIcon = cfg.icon;

  return (
    <div className="mb-5 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-xs font-bold bg-purple-600 text-white px-2 py-0.5 rounded uppercase tracking-wider">ERP</span>
            <h1 className="text-white font-bold text-xl">Dashboard ERP</h1>
          </div>
          <DataSourceDropdown />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setHistoryOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-400 hover:text-white text-xs transition-colors"
          >
            <History className="w-3.5 h-3.5" /> Histórico
          </button>
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={refreshing || !selectedSource}
            className="flex items-center gap-2 px-4 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
          >
            {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {refreshing ? "Atualizando..." : "Atualizar dados"}
          </button>
        </div>
      </div>

      {/* Barra de status */}
      <div className={`flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 rounded-lg border ${cfg.bg}`}>
        <div className="flex items-center gap-2">
          <StatusIcon className={`w-4 h-4 ${cfg.color} ${refreshing ? "animate-spin" : ""}`} />
          <span className={`text-sm font-medium ${cfg.color}`}>{cfg.label}</span>
        </div>
        {lastUpdate && (
          <span className="text-gray-400 text-xs">Última atualização: <span className="text-gray-300 font-medium">{formatDateTime(lastUpdate)}</span></span>
        )}
        {snapshot?.max_date && (
          <span className="text-gray-400 text-xs">Período dos dados: até {snapshot.max_date}</span>
        )}
        {(status === "success" || status === "partial") && latestRun?.duration_ms > 0 && (
          <span className="text-gray-400 text-xs">Duração: {formatDuration(latestRun.duration_ms)}</span>
        )}
        {(status === "success" || status === "partial") && latestRun?.records_valid > 0 && (
          <span className="text-gray-400 text-xs">Registros: {latestRun.records_valid.toLocaleString("pt-BR")}</span>
        )}
        {(status === "success" || status === "partial") && latestRun?.started_by_name && (
          <span className="text-gray-400 text-xs">por {latestRun.started_by_name}</span>
        )}
        {snapshot?.version && (
          <span className="text-gray-500 text-xs">Versão: {snapshot.version}</span>
        )}
      </div>

      {/* Barra de progresso durante atualização */}
      {refreshing && latestRun && (
        <div className="bg-blue-950 border border-blue-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-blue-300 text-sm font-medium">{latestRun.step_label || "Processando..."}</span>
            <span className="text-blue-400 text-xs">{latestRun.progress || 0}%</span>
          </div>
          <div className="w-full bg-blue-900 rounded-full h-2 overflow-hidden">
            <div className="bg-blue-500 h-2 rounded-full transition-all duration-500" style={{ width: `${latestRun.progress || 0}%` }} />
          </div>
          <p className="text-blue-300/70 text-xs mt-2">A versão anterior permanece disponível durante o processamento.</p>
        </div>
      )}

      {/* Alerta de dados antigos */}
      {stale && snapshot && !refreshing && (
        <div className="bg-yellow-950 border border-yellow-800 rounded-lg px-4 py-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-400" />
          <span className="text-yellow-300 text-sm">Os dados desta fonte não são atualizados há {staleDays} {staleDays === 1 ? "dia" : "dias"}.</span>
        </div>
      )}

      {/* Alerta de erro */}
      {latestRun?.status === "failed" && latestRun?.error_message && !refreshing && (
        <div className="bg-red-950 border border-red-800 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-red-400 text-sm font-medium">Não foi possível concluir a atualização. Os dados anteriores continuam disponíveis.</span>
          </div>
          <p className="text-red-300/70 text-xs">{latestRun.error_message}</p>
        </div>
      )}

      {/* Alerta de ressalvas */}
      {latestRun?.status === "partial" && !refreshing && latestRun?.warning_count > 0 && (
        <div className="bg-yellow-950 border border-yellow-800 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
            <span className="text-yellow-400 text-sm font-medium">Atualização concluída, mas alguns registros apresentaram inconsistências.</span>
          </div>
          {latestRun.warnings?.length > 0 && (
            <p className="text-yellow-300/70 text-xs mt-1">{latestRun.warnings.join("; ")}</p>
          )}
        </div>
      )}

      <SyncConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={async () => {
          setConfirmOpen(false);
          try { await refresh(); } catch (e) { /* erro já no estado */ }
        }}
        sourceName={selectedSource?.name}
        lastUpdate={lastUpdate}
        recordCount={snapshot?.record_count}
      />
      <SyncHistoryPanel open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </div>
  );
}