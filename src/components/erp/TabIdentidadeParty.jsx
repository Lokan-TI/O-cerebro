import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useErpSource } from "@/lib/ErpSourceContext";
import { Fingerprint, RefreshCw, AlertTriangle, Users } from "lucide-react";

const n = (v) => (v || 0).toLocaleString("pt-BR");

function Stat({ label, value, hint, tone = "text-white" }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <p className="text-[11px] uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`text-2xl font-semibold mt-1 ${tone}`}>{value}</p>
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  );
}

export default function TabIdentidadeParty() {
  const { selectedSource } = useErpSource();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!selectedSource?.id) return;
      const rows = await base44.entities.PartyResolutionReport.filter(
        { source_id: selectedSource.id, is_current: true }, "-created_at", 1
      );
      if (alive) setReport(rows?.[0] || null);
    })();
    return () => { alive = false; };
  }, [selectedSource?.id]);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("resolvePartyIdentity", { source_id: selectedSource?.id });
      setReport(res.data.report);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Fingerprint className="w-5 h-5 text-purple-400" /> Identity Resolution · Party
          </h2>
          <p className="text-xs text-gray-500">
            Phase 3 · matching determinístico por CNPJ/CPF normalizado. Nenhum merge probabilístico automático.
          </p>
        </div>
        <button onClick={run} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-lg text-sm text-white">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Resolvendo…" : "Executar resolução"}
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-950/40 border border-red-900 rounded-lg p-3 text-sm text-red-300">
          <AlertTriangle className="w-4 h-4 mt-0.5" /> {error}
        </div>
      )}

      {!report && !loading && (
        <p className="text-sm text-gray-500">Nenhuma resolução executada para esta fonte ainda.</p>
      )}

      {report && (
        <>
          <div className="flex items-start gap-2 bg-amber-950/30 border border-amber-900/60 rounded-lg p-3 text-sm text-amber-200/90">
            <Users className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              Reconciliação canônico × legado: <span className="font-medium">{n(report.canonical_customers)}</span> clientes canônicos
              contra <span className="font-medium">{n(report.legacy_customer_count)}</span> registros com papel de cliente
              ({report.reconciliation_diff > 0 ? "+" : ""}{n(report.reconciliation_diff)} · {report.reconciliation_diff_pct}%).
              Versão {report.version}.
            </span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Registros na origem" value={n(report.source_records)} hint="tabela pessoa" />
            <Stat label="Party canônicos" value={n(report.canonical_parties)} tone="text-purple-300" hint="documentos distintos + sem documento" />
            <Stat label="Cobertura de documento" value={`${report.document_coverage}%`} hint={`${n(report.invalid_document)} sem CNPJ/CPF válido`} />
            <Stat label="Taxa de duplicidade" value={`${report.duplicate_rate}%`} tone="text-amber-300" hint={`${n(report.duplicate_groups)} grupos · ${n(report.duplicate_records)} registros`} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-2">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">PartyRole (papéis)</p>
              {[
                ["Customer", report.role_customer],
                ["Supplier", report.role_supplier],
                ["Employee", report.role_employee],
                ["Mais de um papel", report.role_multiple],
                ["Sem papel declarado", report.role_none],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between text-sm border-b border-gray-800/70 py-1.5">
                  <span className="text-gray-400">{label}</span>
                  <span className="text-white">{n(value)}</span>
                </div>
              ))}
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Fila de revisão · maiores duplicidades</p>
              <div className="max-h-64 overflow-y-auto space-y-1">
                {(report.top_duplicates || []).map((d) => (
                  <div key={d.documento} className="flex items-center justify-between gap-3 text-sm border-b border-gray-800/70 py-1.5">
                    <span className="text-gray-300 truncate">{d.nome_exemplo || "—"}</span>
                    <span className="text-gray-500 font-mono text-xs shrink-0">{d.documento}</span>
                    <span className="text-amber-400 shrink-0">{d.registros}×</span>
                  </div>
                ))}
                {!(report.top_duplicates || []).length && <p className="text-sm text-gray-500">Nenhuma duplicidade determinística.</p>}
              </div>
            </div>
          </div>

          {(report.warnings || []).length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-1.5">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Avisos</p>
              {report.warnings.map((w, i) => (
                <p key={i} className="text-sm text-amber-200/80 flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 mt-1 shrink-0" /> {w}
                </p>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}