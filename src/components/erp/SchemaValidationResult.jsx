// Renderiza o resultado da validação de uma fonte contra o Schema Canônico Sisloc.
// Compatível (verde) / Compatível com alertas (amarelo) / Incompatível (vermelho).
import { CheckCircle2, AlertTriangle, XCircle, ShieldCheck } from "lucide-react";

const CLS = {
  "Compatível": { icon: CheckCircle2, color: "text-green-400", bg: "bg-green-950 border-green-800", chip: "bg-green-900 text-green-300" },
  "Compatível com alertas": { icon: AlertTriangle, color: "text-yellow-400", bg: "bg-yellow-950 border-yellow-800", chip: "bg-yellow-900 text-yellow-300" },
  "Incompatível": { icon: XCircle, color: "text-red-400", bg: "bg-red-950 border-red-800", chip: "bg-red-900 text-red-300" },
};

const LAYER_LABEL = { dim: "Dimensão", fato: "Fato", movimento: "Movimento", financeiro: "Financeiro" };

export default function SchemaValidationResult({ result, loading }) {
  if (loading) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-purple-400 animate-pulse" />
        <span className="text-gray-400 text-sm">Validando estrutura contra o schema canônico Sisloc…</span>
      </div>
    );
  }
  if (!result) return null;

  if (result.success === false) {
    const c = CLS["Incompatível"];
    const Icon = c.icon;
    return (
      <div className={`rounded-xl border p-4 ${c.bg}`}>
        <div className="flex items-center gap-2 mb-1">
          <Icon className={`w-4 h-4 ${c.color}`} />
          <span className={`text-sm font-medium ${c.color}`}>{result.classification || "Incompatível"}</span>
        </div>
        <p className="text-gray-300 text-sm">{result.message || result.error || "Não foi possível validar a estrutura."}</p>
      </div>
    );
  }

  const c = CLS[result.classification] || CLS["Incompatível"];
  const Icon = c.icon;
  const tables = result.table_checks || [];
  const missingReq = result.missing_required || [];
  const missingOpt = result.missing_optional || [];

  return (
    <div className={`rounded-xl border p-4 ${c.bg}`}>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${c.color}`} />
          <span className={`text-sm font-semibold ${c.color}`}>{result.classification}</span>
          <span className={`text-xs px-2 py-0.5 rounded ${c.chip}`}>Schema v{result.schema_version}</span>
        </div>
        {result.response_time_ms != null && (
          <span className="text-gray-500 text-xs">{result.response_time_ms}ms · {result.tables_found}/{result.table_count} tabelas</span>
        )}
      </div>
      <p className="text-gray-300 text-sm mb-3">{result.message}</p>

      {(missingReq.length > 0 || missingOpt.length > 0) && (
        <div className="space-y-2 mb-3">
          {missingReq.length > 0 && (
            <div className="rounded-lg bg-red-950/40 border border-red-900/40 p-2">
              <div className="text-red-300 text-xs font-semibold mb-1">Obrigatórios ausentes ({missingReq.length}) — bloqueia publicação</div>
              <div className="flex flex-wrap gap-1">
                {missingReq.map((m, i) => (
                  <span key={i} className="text-xs bg-red-900/60 text-red-200 px-1.5 py-0.5 rounded">{m.table}{m.column ? `.${m.column}` : ""}</span>
                ))}
              </div>
            </div>
          )}
          {missingOpt.length > 0 && (
            <div className="rounded-lg bg-yellow-950/40 border border-yellow-900/40 p-2">
              <div className="text-yellow-300 text-xs font-semibold mb-1">Opcionais ausentes ({missingOpt.length}) — dashboards parciais</div>
              <div className="flex flex-wrap gap-1">
                {missingOpt.map((m, i) => (
                  <span key={i} className="text-xs bg-yellow-900/50 text-yellow-200 px-1.5 py-0.5 rounded">{m.table}{m.column ? `.${m.column}` : ""}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {tables.map((t) => (
          <div key={t.name} className="flex items-center gap-2 bg-gray-900/40 rounded px-2 py-1.5">
            {t.exists ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
            <span className="text-gray-200 text-xs font-mono flex-1">{t.name}</span>
            <span className="text-gray-600 text-[10px]">{LAYER_LABEL[t.layer] || t.layer}</span>
            {t.required
              ? <span className="text-[10px] bg-gray-700 text-gray-300 px-1 rounded">obrig.</span>
              : <span className="text-[10px] bg-gray-800 text-gray-500 px-1 rounded">opc.</span>}
          </div>
        ))}
      </div>
    </div>
  );
}