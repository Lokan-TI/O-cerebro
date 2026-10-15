import { useCallback, useEffect, useState } from "react";
import { Loader2, Download } from "lucide-react";
import { base44 } from "@/api/base44Client";
import RdRankBars from "./RdRankBars";

// Regra explícita (a validar com o gestor): modelo de plataforma = código numérico + letra (ex.: "45 D", "135 D").
const PLATFORM_RE = /^\d+\s*[A-Z]{1,2}$/i;

export default function RdPlatformsKpi({ period }) {
  const [data, setData] = useState(null);
  const [onlyPlatforms, setOnlyPlatforms] = useState(true);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");

  const scope = { product: "crm_deal", source_created_at: { $gte: period.start, $lt: period.endExclusive } };

  const load = useCallback(async () => {
    const [rank, total, done, withProducts] = await Promise.all([
      base44.entities.RdDealProduct.aggregate({ query: { deal_created_at: scope.source_created_at }, groupBy: "product_name", sum: "quantity", sort: "-count", limit: 200 }),
      base44.entities.RdLead.count(scope),
      base44.entities.RdLead.count({ ...scope, products_synced_at: { $exists: true } }),
      base44.entities.RdLead.count({ ...scope, products_count: { $gt: 0 } }),
    ]);
    setData({ rows: rank.rows, total, done, withProducts });
  }, [period.start, period.endExclusive]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setData(null); load(); }, [load]);

  const extract = async () => {
    setError("");
    let remaining = 1;
    while (remaining > 0) {
      const res = await base44.functions.invoke("rdDealProducts", { start: period.start, endExclusive: period.endExclusive }).catch((e) => ({ data: { error: e.message } }));
      if (res.data?.error) { setError(res.data.error); break; }
      remaining = res.data.remaining;
      setProgress({ done: res.data.total - remaining, total: res.data.total });
      if (!res.data.processed) break;
    }
    setProgress(null);
    load();
  };

  if (!data) return <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 flex items-center gap-2 text-xs text-gray-400"><Loader2 className="w-4 h-4 animate-spin" /> Plataformas mais solicitadas…</div>;

  const rows = data.rows
    .filter((r) => !onlyPlatforms || PLATFORM_RE.test((r.product_name || "").trim()))
    .map((r) => ({ label: r.product_name, value: r.sum_quantity || 0 }));
  const pending = data.total - data.done;

  return (
    <div className="space-y-2">
      <RdRankBars
        title={onlyPlatforms ? "Plataformas mais solicitadas" : "Produtos mais solicitados (todos)"}
        rows={rows}
        note={`Fonte: produtos das negociações do RD CRM criadas no período (quantidade solicitada). Cobertura: ${data.done}/${data.total} negociações extraídas, ${data.withProducts} com produto informado.${onlyPlatforms ? ' Plataforma = código numérico + letra (ex.: "45 D") — regra a validar.' : ""}`}
      />
      <div className="flex flex-wrap items-center gap-3 text-[11px]">
        <label className="flex items-center gap-1.5 text-gray-400 cursor-pointer">
          <input type="checkbox" checked={onlyPlatforms} onChange={(e) => setOnlyPlatforms(e.target.checked)} /> Somente modelos de plataforma
        </label>
        {pending > 0 && (
          <button onClick={extract} disabled={!!progress} className="flex items-center gap-1 px-2 py-1 rounded-md bg-purple-600/80 hover:bg-purple-600 text-white disabled:opacity-60">
            {progress ? <><Loader2 className="w-3 h-3 animate-spin" /> {progress.done}/{progress.total}</> : <><Download className="w-3 h-3" /> Extrair produtos ({pending} pendentes)</>}
          </button>
        )}
        {error && <span className="text-red-400">{error}</span>}
      </div>
    </div>
  );
}