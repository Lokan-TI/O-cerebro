import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useErpSource } from "@/lib/ErpSourceContext";
import { RefreshCw, ShieldAlert, AlertTriangle } from "lucide-react";
import OnboardingScoreCard from "./OnboardingScoreCard";

export default function TabOnboardingFonte() {
  const { selectedSource } = useErpSource();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await base44.entities.SourceOnboardingReport.filter({ is_current: true }, "-created_date", 5);
      const match = selectedSource?.id ? list.find((r) => r.source_id === selectedSource.id) : null;
      setReport(match || list[0] || null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [selectedSource?.id]);

  useEffect(() => { load(); }, [load]);

  const run = async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("discoverSource", { source_id: selectedSource?.id });
      setReport(res.data?.report || null);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setRunning(false);
    }
  };

  if (loading) return <div className="text-gray-400 text-sm">Carregando relatório de onboarding…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-white">Onboarding da fonte</h2>
          <p className="text-xs text-gray-500">
            {report
              ? `Versão ${report.version} · ${report.source_name} · ${report.query_count} consultas · ${Math.round((report.duration_ms || 0) / 1000)}s`
              : "Nenhuma descoberta executada para esta fonte."}
          </p>
        </div>
        <button
          onClick={run}
          disabled={running}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-lg text-sm text-white"
        >
          <RefreshCw className={`w-4 h-4 ${running ? "animate-spin" : ""}`} />
          {running ? "Descobrindo…" : "Executar descoberta"}
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-950/40 border border-red-900 rounded-lg p-3 text-sm text-red-300">
          <AlertTriangle className="w-4 h-4 mt-0.5" /> {error}
        </div>
      )}

      {report && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <OnboardingScoreCard score={report.trust_score} breakdown={report.trust_breakdown} />
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Inventário</p>
              {[
                ["Tabelas catalogadas", report.table_count],
                ["Colunas catalogadas", report.column_count],
                ["Colunas documentadas", `${report.documented_columns} (${report.documentation_coverage}%)`],
                ["Chaves estrangeiras", report.fk_declared],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm">
                  <span className="text-gray-400">{k}</span>
                  <span className="text-white font-medium">{v}</span>
                </div>
              ))}
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5" /> Dados pessoais (PII)
              </p>
              <p className="text-3xl font-semibold text-amber-400">{report.pii_count}</p>
              <p className="text-xs text-gray-500 mt-1">colunas classificadas como dado pessoal</p>
              <div className="mt-3 max-h-40 overflow-y-auto space-y-1">
                {(report.pii_columns || []).slice(0, 60).map((c, i) => (
                  <div key={i} className="text-xs text-gray-400 flex justify-between gap-2">
                    <span className="truncate">{c.tabela}.{c.coluna}</span>
                    <span className="text-gray-600 shrink-0">{c.categoria}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Tabelas críticas de negócio</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {(report.core_tables || []).map((t) => (
                <div key={t.tabela} className="flex items-center justify-between bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm">
                  <span className="text-gray-300 font-mono text-xs">{t.tabela}</span>
                  <span className={t.presente ? "text-emerald-400 text-xs" : "text-red-400 text-xs"}>
                    {t.presente ? `${t.colunas} col.` : "ausente"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {(report.warnings || []).length > 0 && (
            <div className="bg-amber-950/30 border border-amber-900/60 rounded-xl p-4">
              <p className="text-xs text-amber-400 uppercase tracking-wide mb-2">Avisos</p>
              <ul className="space-y-1 text-sm text-amber-200/80 list-disc pl-4">
                {report.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}