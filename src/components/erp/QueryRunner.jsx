import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useErpSource } from "@/lib/ErpSourceContext";
import { Play, Loader2 } from "lucide-react";

const PRESETS = [
  { label: "Listar Tabelas", sql: "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME" },
  { label: "Listar Colunas", sql: "SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS ORDER BY TABLE_NAME, ORDINAL_POSITION" },
  { label: "Top 10 Registros", sql: "SELECT TOP 10 * FROM " },
];

export default function QueryRunner() {
  const { selectedSource } = useErpSource();
  const [sql, setSql] = useState("");
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [execTime, setExecTime] = useState(null);

  const execute = async () => {
    if (!sql.trim()) return;
    setLoading(true);
    setError(null);
    setRows(null);
    const start = Date.now();
    try {
      const res = await base44.functions.invoke("sqlServerQuery", { query: sql, source_id: selectedSource?.id });
      setRows(res?.data?.rows || []);
      setExecTime(Date.now() - start);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "Erro");
    } finally {
      setLoading(false);
    }
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
    </div>
  );
}