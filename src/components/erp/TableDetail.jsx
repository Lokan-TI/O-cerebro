import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { RefreshCw, Table2, ArrowRightLeft, ArrowRight, Eye, X } from "lucide-react";

function buildColumnQuery(table) {
  const safe = table.replace(/'/g, "''");
  return `SELECT c.name AS coluna, t.name AS tipo, c.is_nullable AS nulavel FROM sys.columns c JOIN sys.types t ON c.user_type_id = t.user_type_id JOIN sys.tables tb ON c.object_id = tb.object_id WHERE tb.name = '${safe}' ORDER BY c.column_id`;
}

function buildSampleQuery(table) {
  const safe = table.replace(/]/g, "]]");
  return `SELECT TOP 10 * FROM [${safe}]`;
}

function fmtCount(n) {
  if (n == null) return "—";
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}

export default function TableDetail({ tableName, rowCounts, fks, onSelectTable }) {
  const [columns, setColumns] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showSample, setShowSample] = useState(false);
  const [sample, setSample] = useState(null);
  const [sampleLoading, setSampleLoading] = useState(false);

  useEffect(() => {
    setColumns(null);
    setShowSample(false);
    setSample(null);
    setLoading(true);
    base44.functions.invoke("sqlServerQuery", { query: buildColumnQuery(tableName) })
      .then(res => setColumns(res?.data?.rows || []))
      .catch(() => setColumns([]))
      .finally(() => setLoading(false));
  }, [tableName]);

  const incomingFks = fks.filter(f => f.pk_table === tableName);
  const outgoingFks = fks.filter(f => f.fk_table === tableName);
  const rc = rowCounts[tableName] || 0;

  const loadSample = async () => {
    if (showSample) { setShowSample(false); return; }
    setShowSample(true);
    if (sample) return;
    setSampleLoading(true);
    try {
      const res = await base44.functions.invoke("sqlServerQuery", { query: buildSampleQuery(tableName) });
      setSample(res?.data?.rows || []);
    } catch (e) {
      setSample({ error: e?.response?.data?.error || e?.message || "Erro ao buscar dados" });
    } finally {
      setSampleLoading(false);
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Table2 className="w-4 h-4 text-purple-400" />
              <h2 className="text-white font-semibold text-base">{tableName}</h2>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span>{fmtCount(rc)} registros</span>
              <span>{columns?.length || 0} colunas</span>
              <span className="flex items-center gap-1">
                <ArrowRightLeft className="w-3 h-3" /> {incomingFks.length + outgoingFks.length} rel.
              </span>
            </div>
          </div>
          <button
            onClick={loadSample}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              showSample ? "bg-purple-600 text-white border-purple-500" : "bg-gray-800 text-gray-300 hover:text-white border-gray-700"
            }`}
          >
            {showSample ? <X className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showSample ? "Fechar" : "Ver dados"}
          </button>
        </div>
      </div>

      {/* Sample data */}
      {showSample && (
        <div className="p-4 border-b border-gray-800 bg-gray-950/50">
          <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-2">Amostra (10 registros)</p>
          {sampleLoading ? (
            <div className="flex items-center gap-2 text-gray-500 text-sm"><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Carregando...</div>
          ) : sample?.error ? (
            <p className="text-red-400 text-xs">{sample.error}</p>
          ) : sample?.length > 0 ? (
            <div className="overflow-x-auto max-h-64">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-800">
                    {Object.keys(sample[0]).map(k => (
                      <th key={k} className="text-left px-2 py-1 whitespace-nowrap font-medium">{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sample.map((row, i) => (
                    <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      {Object.values(row).map((v, j) => (
                        <td key={j} className="px-2 py-1 text-gray-300 whitespace-nowrap max-w-xs truncate" title={String(v)}>
                          {v == null ? "—" : String(v)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-600 text-xs">Tabela vazia</p>
          )}
        </div>
      )}

      {/* Relationships */}
      {(incomingFks.length > 0 || outgoingFks.length > 0) && (
        <div className="p-4 border-b border-gray-800 grid sm:grid-cols-2 gap-4">
          {incomingFks.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-2">
                Referenciada por ({incomingFks.length})
              </p>
              <div className="space-y-1">
                {incomingFks.map((f, i) => (
                  <button
                    key={i}
                    onClick={() => onSelectTable(f.fk_table)}
                    className="w-full flex items-center gap-1.5 px-2 py-1 rounded bg-gray-800/50 hover:bg-gray-800 text-xs text-gray-300 hover:text-white text-left border border-transparent hover:border-gray-700"
                  >
                    <span className="truncate flex-1">
                      <span className="text-purple-400">{f.fk_table}</span>
                      <span className="text-gray-600">.{f.fk_column}</span>
                    </span>
                    <ArrowRight className="w-3 h-3 text-gray-600 shrink-0" />
                    <span className="text-gray-500 truncate">{f.pk_column}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {outgoingFks.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-2">
                Referencia ({outgoingFks.length})
              </p>
              <div className="space-y-1">
                {outgoingFks.map((f, i) => (
                  <button
                    key={i}
                    onClick={() => onSelectTable(f.pk_table)}
                    className="w-full flex items-center gap-1.5 px-2 py-1 rounded bg-gray-800/50 hover:bg-gray-800 text-xs text-gray-300 hover:text-white text-left border border-transparent hover:border-gray-700"
                  >
                    <span className="text-gray-500 truncate">{f.fk_column}</span>
                    <ArrowRight className="w-3 h-3 text-gray-600 shrink-0" />
                    <span className="truncate flex-1">
                      <span className="text-blue-400">{f.pk_table}</span>
                      <span className="text-gray-600">.{f.pk_column}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Columns */}
      <div className="p-4">
        <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-2">Colunas</p>
        {loading ? (
          <div className="flex items-center gap-2 text-gray-500 text-sm"><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Carregando colunas...</div>
        ) : columns?.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-800">
                  <th className="text-left px-2 py-1.5 font-medium w-1/2">Coluna</th>
                  <th className="text-left px-2 py-1.5 font-medium">Tipo</th>
                  <th className="text-left px-2 py-1.5 font-medium">Nulável</th>
                </tr>
              </thead>
              <tbody>
                {columns.map((c, i) => (
                  <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-2 py-1.5 text-gray-200 font-mono">{c.coluna}</td>
                    <td className="px-2 py-1.5 text-gray-400 font-mono">{c.tipo}</td>
                    <td className="px-2 py-1.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${c.nulavel ? "bg-gray-800 text-gray-500" : "bg-red-950 text-red-400"}`}>
                        {c.nulavel ? "NULL" : "NOT NULL"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-600 text-xs">Nenhuma coluna encontrada</p>
        )}
      </div>
    </div>
  );
}