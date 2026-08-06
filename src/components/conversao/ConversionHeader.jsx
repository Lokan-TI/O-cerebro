import { RefreshCw, Download, Database, CalendarRange, CheckCircle2, AlertTriangle } from "lucide-react";

export default function ConversionHeader({
  sourceName, snapshot, loading, refreshing, error,
  periodStart, periodEnd, onPeriodChange, onRefresh, onExport,
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Conversão de Novos Clientes</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Cadastro na base → ficha de locação → nota fiscal
          </p>
        </div>
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="block text-[10px] uppercase text-gray-500 mb-1">Fonte de dados</label>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-200">
              <Database className="w-3.5 h-3.5 text-purple-400" /> {sourceName || "—"}
            </div>
          </div>
          <div>
            <label className="block text-[10px] uppercase text-gray-500 mb-1">Cadastros de</label>
            <input type="date" value={periodStart} onChange={(e) => onPeriodChange(e.target.value, periodEnd)}
              className="px-3 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-200" />
          </div>
          <div>
            <label className="block text-[10px] uppercase text-gray-500 mb-1">até</label>
            <input type="date" value={periodEnd} onChange={(e) => onPeriodChange(periodStart, e.target.value)}
              className="px-3 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-200" />
          </div>
          <button onClick={onRefresh} disabled={refreshing}
            className="flex items-center gap-2 px-4 py-1.5 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium">
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Atualizando…" : "Atualizar dados"}
          </button>
          <button onClick={onExport} disabled={!snapshot}
            className="flex items-center gap-2 px-4 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 disabled:opacity-50 text-gray-200 rounded-lg text-sm font-medium">
            <Download className="w-4 h-4" /> Exportar
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-800/50 bg-red-950/40 px-4 py-2.5 text-red-300 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <div className="flex items-center gap-4 flex-wrap rounded-lg border border-gray-800 bg-gray-900/60 px-4 py-2.5 text-xs">
        {snapshot ? (
          <>
            <span className="flex items-center gap-1.5 text-green-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" /> Dados publicados
            </span>
            <span className="text-gray-500">Última atualização: <span className="text-gray-300">{snapshot.created_at ? new Date(snapshot.created_at).toLocaleString("pt-BR") : "—"}</span></span>
            <span className="text-gray-500 flex items-center gap-1"><CalendarRange className="w-3 h-3" /> Coorte: <span className="text-gray-300">{snapshot.period_start} → {snapshot.period_end}</span></span>
            <span className="text-gray-500">Por: <span className="text-gray-300">{snapshot.generated_by_name || "—"}</span></span>
            <span className="text-gray-600 ml-auto">Versão: {snapshot.version}</span>
          </>
        ) : (
          <span className="text-gray-500">{loading ? "Carregando camada analítica…" : 'Nenhuma versão publicada. Clique em "Atualizar dados".'}</span>
        )}
      </div>
    </div>
  );
}