import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useErpSource } from "@/lib/ErpSourceContext";
import DashboardQueryList from "./DashboardQueryList";
import { Play, Loader2, History, Trash2, Clock, CheckCircle2, XCircle } from "lucide-react";

const PRESETS = [
  { label: "Listar Tabelas", sql: "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME" },
  { label: "Listar Colunas", sql: "SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS ORDER BY TABLE_NAME, ORDINAL_POSITION" },
  { label: "Top 10 Registros", sql: "SELECT TOP 10 * FROM " },
];

const HISTORY_KEY = "erp_query_history";
const HISTORY_LIMIT = 50;

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveHistory(items) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(items)); } catch {}
}

function formatTs(ts) {
  const d = new Date(ts);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function QueryRunner() {
  const { selectedSource } = useErpSource();
  const [sql, setSql] = useState("");
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [execTime, setExecTime] = useState(null);
  const [history, setHistory] = useState(() => loadHistory());

  const recordQuery = (entry) => {
    setHistory(prev => {
      const next = [entry, ...prev].slice(0, HISTORY_LIMIT);
      saveHistory(next);
      return next;
    });
  };

  const clearHistory = () => {
    setHistory([]);
    saveHistory([]);
  };

  const execute = async () => {
    if (!sql.trim()) return;
    setLoading(true);
    setError(null);
    setRows(null);
    const start = Date.now();
    const query = sql.trim();
    let result;
    try {
      const res = await base44.functions.invoke("sqlServerQuery", { query, source_id: selectedSource?.id });
      const r = res?.data?.rows || [];
      const ms = Date.now() - start;
      setRows(r);
      setExecTime(ms);
      result = { success: true, rowCount: r.length };
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || "Erro";
      setError(msg);
      result = { success: false, rowCount: 0, error: msg };
    } finally {
      setLoading(false);
    }
    recordQuery({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sql: query,
      source_id: selectedSource?.id,
      source_name: selectedSource?.name || null,
      ts: new Date().toISOString(),
      duration_ms: Date.now() - start,
      success: result.success,
      rowCount: result.rowCount,
      error: result.error || null,
    });
  };

  const columns = rows?.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map(p => (
          <button key={p.label} onClick={() => setSql(p.sql)} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-xs text-gray-400 hover:text-white transition-colors">
            {p.label}
          </button>
        ))}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <textarea
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          placeholder="Digite sua query SQL..."
          className="w-full bg-gray-950 text-gray-200 text-sm rounded-lg p-3 h-32 resize-y font-mono border border-gray-800 focus:border-blue-500 outline-none"
          onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") execute(); }}
        />
        <div className="flex items-center justify-between mt-3">
          <span className="text-gray-500 text-xs">
            {rows != null && `${rows.length} linha(s)`}
            {execTime != null && ` · ${execTime}ms`}
            <span className="ml-2 text-gray-600">Ctrl+Enter para executar</span>
          </span>
          <button onClick={execute} disabled={loading || !sql.trim()} className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Executar
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-950 border border-red-800 rounded-xl p-4">
          <p className="text-red-400 text-sm font-mono whitespace-pre-wrap">{error}</p>
        </div>
      )}

      {rows != null && rows.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-sm">
              <thead className="bg-gray-800 border-b border-gray-700 sticky top-0">
                <tr>
                  {columns.map(col => <th key={col} className="text-left px-4 py-2 text-gray-400 font-medium text-xs uppercase tracking-wider whitespace-nowrap">{col}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 200).map((row, i) => (
                  <tr key={i} className="border-b border-gray-800 hover:bg-gray-800/50">
                    {columns.map(col => <td key={col} className="px-4 py-2 text-gray-300 whitespace-nowrap">{String(row[col] ?? "")}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 200 && <p className="text-gray-500 text-xs p-2 text-center">Mostrando 200 de {rows.length} linhas</p>}
        </div>
      )}
      {rows != null && rows.length === 0 && !error && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <p className="text-gray-500 text-sm">Query executada — 0 linhas retornadas</p>
        </div>
      )}

      {/* Lista das queries que capturam os dados dos dashboards */}
      <DashboardQueryList onLoadQuery={(q) => { setSql(q); setRows(null); setError(null); setExecTime(null); }} />

      {/* Histórico de queries */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-950">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-purple-400" />
            <span className="text-white text-sm font-medium">Histórico de Queries</span>
            <span className="text-gray-500 text-xs">({history.length})</span>
          </div>
          {history.length > 0 && (
            <button onClick={clearHistory} className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-500 hover:text-red-400 transition-colors">
              <Trash2 className="w-3 h-3" />
              Limpar
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-600 text-sm">Nenhuma query registrada ainda.</p>
          </div>
        ) : (
          <div className="max-h-[400px] overflow-y-auto divide-y divide-gray-800">
            {history.map(h => (
              <div
                key={h.id}
                onClick={() => setSql(h.sql)}
                className="px-4 py-3 hover:bg-gray-800/50 cursor-pointer transition-colors group"
              >
                <div className="flex items-center justify-between gap-3 mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    {h.success ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    )}
                    <span className="text-gray-500 text-xs flex items-center gap-1 shrink-0">
                      <Clock className="w-3 h-3" />
                      {formatTs(h.ts)}
                    </span>
                    <span className="text-gray-600 text-xs">·</span>
                    <span className="text-gray-500 text-xs">{h.duration_ms}ms</span>
                    {h.success && (
                      <>
                        <span className="text-gray-600 text-xs">·</span>
                        <span className="text-gray-500 text-xs">{h.rowCount} linha(s)</span>
                      </>
                    )}
                    {h.source_name && (
                      <>
                        <span className="text-gray-600 text-xs">·</span>
                        <span className="text-gray-600 text-xs truncate">{h.source_name}</span>
                      </>
                    )}
                  </div>
                  <span className="text-gray-700 group-hover:text-gray-400 text-xs shrink-0">Clique para reusar →</span>
                </div>
                <pre className="text-gray-300 text-xs font-mono whitespace-pre-wrap break-all line-clamp-2">
                  {h.sql}
                </pre>
                {!h.success && h.error && (
                  <p className="text-red-500/80 text-xs mt-1 line-clamp-1">{h.error}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}