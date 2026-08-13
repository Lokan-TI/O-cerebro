import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useErpSource } from "@/lib/ErpSourceContext";
import { RefreshCw, AlertTriangle, ShieldQuestion } from "lucide-react";

const fmt = (v) =>
  (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export default function TabReconciliacaoReceita() {
  const { selectedSource } = useErpSource();
  const [start, setStart] = useState("2025-01-01");
  const [end, setEnd] = useState("2026-01-01");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("reconcileRevenue", {
        source_id: selectedSource?.id,
        period_start: start,
        period_end: end,
      });
      setData(res.data);
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
          <h2 className="text-lg font-semibold text-white">MTR-001 · Reconciliação de Receita</h2>
          <p className="text-xs text-gray-500">
            Compara os candidatos a Source of Truth. Nenhum é oficial até decisão do dono de negócio.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <label className="text-xs text-gray-500">
            Início
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)}
              className="block bg-gray-900 border border-gray-800 rounded-lg px-2 py-1.5 text-sm text-white" />
          </label>
          <label className="text-xs text-gray-500">
            Fim (exclusivo)
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)}
              className="block bg-gray-900 border border-gray-800 rounded-lg px-2 py-1.5 text-sm text-white" />
          </label>
          <button onClick={run} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-lg text-sm text-white">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Reconciliando…" : "Reconciliar"}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-950/40 border border-red-900 rounded-lg p-3 text-sm text-red-300">
          <AlertTriangle className="w-4 h-4 mt-0.5" /> {error}
        </div>
      )}

      {data && (
        <>
          <div className="flex items-start gap-2 bg-amber-950/30 border border-amber-900/60 rounded-lg p-3 text-sm text-amber-200/90">
            <ShieldQuestion className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{data.note} Universo: {data.universe.invoice_count.toLocaleString("pt-BR")} NFs de saída não canceladas por <span className="font-mono">{data.period.date_field}</span>.</span>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-950 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Candidato</th>
                  <th className="text-right px-4 py-2 font-medium">Total</th>
                  <th className="text-right px-4 py-2 font-medium">Δ vs. referência</th>
                  <th className="text-right px-4 py-2 font-medium">Δ %</th>
                </tr>
              </thead>
              <tbody>
                {data.candidates.map((c) => (
                  <tr key={c.id} className="border-t border-gray-800">
                    <td className="px-4 py-2 text-gray-300">{c.label}</td>
                    <td className="px-4 py-2 text-right text-white font-medium">{fmt(c.total)}</td>
                    <td className="px-4 py-2 text-right text-gray-400">{c.diff_vs_reference ? fmt(c.diff_vs_reference) : "—"}</td>
                    <td className={`px-4 py-2 text-right ${c.diff_pct_vs_reference ? "text-red-400" : "text-gray-500"}`}>
                      {c.diff_pct_vs_reference ? `${c.diff_pct_vs_reference}%` : "referência"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-2">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Qualidade do universo</p>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">NFs excluídas (canceladas/anuladas)</span>
                <span className="text-white">{data.excluded_invoices.invoice_count.toLocaleString("pt-BR")} · {fmt(data.excluded_invoices.amount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">NFs válidas com valor zerado</span>
                <span className="text-amber-400">{data.zero_amount_invoices.toLocaleString("pt-BR")}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Consultas executadas</span>
                <span className="text-white">{data.query_count}</span>
              </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Por empresa</p>
              <div className="max-h-56 overflow-y-auto space-y-1">
                {data.by_empresa.map((e) => (
                  <div key={e.cd_empresa} className="flex items-center justify-between text-sm border-b border-gray-800/70 py-1.5">
                    <span className="text-gray-400">Empresa {String(e.cd_empresa).padStart(3, "0")} <span className="text-gray-600 text-xs">({e.invoice_count} NFs)</span></span>
                    <span className="text-gray-300">{fmt(e.a_faturamento)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}