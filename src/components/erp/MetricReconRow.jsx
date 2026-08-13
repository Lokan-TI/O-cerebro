import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Check, Save } from "lucide-react";

const STATUS = {
  match: { label: "ADERENTE", cls: "bg-emerald-950/40 border-emerald-800 text-emerald-300" },
  warn: { label: "ATENÇÃO", cls: "bg-amber-950/40 border-amber-800 text-amber-300" },
  fail: { label: "DIVERGENTE", cls: "bg-red-950/40 border-red-900 text-red-300" },
  no_legacy: { label: "SEM LEGADO", cls: "bg-gray-800 border-gray-700 text-gray-400" },
};

function fmt(value, unit) {
  if (value == null) return "—";
  if (unit === "BRL") return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  if (unit === "percent") return `${value.toFixed(1)}%`;
  return value.toLocaleString("pt-BR");
}

export default function MetricReconRow({ row, onSaved }) {
  const [text, setText] = useState(row.justification || "");
  const [saving, setSaving] = useState(false);
  const st = STATUS[row.status] || STATUS.no_legacy;
  const needsReview = row.status === "warn" || row.status === "fail";

  const save = async (approved) => {
    if (!row.id) return;
    setSaving(true);
    await base44.entities.MetricReconciliation.update(row.id, { justification: text, approved });
    setSaving(false);
    onSaved?.();
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-gray-500">{row.metric_id}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full border ${st.cls}`}>{st.label}</span>
            {row.approved && (
              <span className="text-xs px-2 py-0.5 rounded-full border border-sky-800 bg-sky-950/40 text-sky-300 flex items-center gap-1">
                <Check className="w-3 h-3" /> divergência aceita
              </span>
            )}
          </div>
          <p className="text-white font-medium mt-1">{row.business_name}</p>
          <p className="text-xs text-gray-500">Legado: {row.legacy_source}</p>
        </div>

        <div className="flex gap-6 text-right">
          <div>
            <p className="text-xs text-gray-500">Legado</p>
            <p className="text-lg text-gray-300">{fmt(row.legacy_value, row.unit)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Canônico</p>
            <p className="text-lg text-white">{fmt(row.canonical_value, row.unit)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Divergência</p>
            <p className={`text-lg ${row.status === "match" ? "text-emerald-400" : row.status === "fail" ? "text-red-400" : "text-amber-400"}`}>
              {row.diff_pct == null ? "—" : `${row.diff_pct > 0 ? "+" : ""}${row.diff_pct}%`}
            </p>
          </div>
        </div>
      </div>

      {needsReview && (
        <div className="flex gap-2 items-start">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            placeholder="Justificativa da divergência (obrigatória para aceitar)"
            className="flex-1 bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200"
          />
          <div className="flex flex-col gap-2">
            <button onClick={() => save(row.approved)} disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-xs text-gray-300">
              <Save className="w-3.5 h-3.5" /> Salvar
            </button>
            <button onClick={() => save(true)} disabled={saving || !text.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-700 hover:bg-sky-600 disabled:opacity-50 rounded-lg text-xs text-white">
              <Check className="w-3.5 h-3.5" /> Aceitar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}