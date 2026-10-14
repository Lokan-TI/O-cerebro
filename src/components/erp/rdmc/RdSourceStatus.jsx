import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { dt } from "@/lib/rdJourney";

export default function RdSourceStatus() {
  const [runs, setRuns] = useState(null);
  useEffect(() => {
    Promise.all(["marketing", "crm"].map((p) => base44.entities.RdSyncRun.filter({ product: p }, { sort: "-created_date", limit: 1 })))
      .then((r) => setRuns(r.map((x) => x.items[0])));
  }, []);
  if (!runs) return <div className="text-xs text-gray-500">Verificando fontes…</div>;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {["Marketing", "CRM"].map((label, i) => {
        const r = runs[i];
        const cls = !r ? "border-gray-700 text-gray-400" : r.status === "error" ? "border-red-800 text-red-300" : r.status === "done" ? "border-emerald-800 text-emerald-300" : "border-amber-800 text-amber-300";
        const txt = !r ? "nunca sincronizado" : r.status === "error" ? `falha: ${String(r.last_error || "").slice(0, 80)}` : r.status === "done" ? `atualizado em ${dt(r.finished_at)}` : "sincronização em andamento";
        return <span key={label} className={`border rounded-md px-2 py-1 ${cls}`}>RD {label}: {txt}</span>;
      })}
      <Link to="/Integracoes" className="text-purple-400 hover:underline">Sincronizar dados RD →</Link>
    </div>
  );
}