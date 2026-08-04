import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { RefreshCw, Pencil, Save, X } from "lucide-react";

export default function KpiCard({ id, label, defaultSql, accent = "border-blue-500", sub, format = "number" }) {
  const [sql, setSql] = useState(() => localStorage.getItem(`kpi_sql_${id}`) || defaultSql);
  const [value, setValue] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);

  const execute = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("sqlServerQuery", { query: sql });
      const rows = res?.data?.rows || [];
      if (rows.length > 0) {
        const firstKey = Object.keys(rows[0])[0];
        setValue(rows[0][firstKey]);
      } else {
        setValue("—");
      }
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "Erro");
      setValue(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { execute(); }, []);

  const saveSql = () => {
    localStorage.setItem(`kpi_sql_${id}`, sql);
    setEditing(false);
    execute();
  };

  const fmtValue = (v) => {
    if (v == null) return "—";
    const n = typeof v === "number" ? v : parseFloat(v);
    if (isNaN(n)) return String(v);
    if (format === "currency") {
      return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    }
    return n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  };

  return (
    <div className={`bg-gray-900 border-l-4 ${accent} rounded-lg p-4 h-full`}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-gray-400 text-xs uppercase tracking-wider">{label}</p>
        <div className="flex items-center gap-1">
          <button onClick={execute} className="text-gray-500 hover:text-white" disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={() => setEditing(!editing)} className="text-gray-500 hover:text-white">
            {editing ? <X className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
      {editing ? (
        <div className="space-y-2">
          <textarea
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            className="w-full bg-gray-950 text-gray-200 text-xs rounded p-2 h-24 resize-none font-mono border border-gray-800 focus:border-blue-500 outline-none"
            placeholder="SELECT ..."
          />
          <button onClick={saveSql} className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium">
            <Save className="w-3 h-3" /> Salvar e Executar
          </button>
        </div>
      ) : (
        <>
          <p className="text-3xl font-bold text-white">
            {loading ? <span className="text-gray-600 text-sm">Carregando...</span> :
             error ? <span className="text-red-400 text-sm font-normal">Erro</span> :
             fmtValue(value)}
          </p>
          {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
          {error && <p className="text-red-500 text-xs mt-1 truncate" title={error}>{error}</p>}
        </>
      )}
    </div>
  );
}