import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Download, Loader2 } from "lucide-react";
import { fmtCur } from "@/lib/erpFormat";
import { MATCH_LABEL, PRODUCT_LABEL } from "@/lib/rdFunnelQuery";
import { exportRdTrace } from "./rdTraceExport";
import RdMatchDialog from "./RdMatchDialog";

const REVIEW = ["ambiguous", "unmatched", "matched", "manual", "rejected"];

export default function RdTraceTable({ query, onChanged }) {
  const [page, setPage] = useState({ items: [], cursor: null, loading: true });
  const [review, setReview] = useState(null);
  const [exporting, setExporting] = useState(false);
  const key = JSON.stringify(query);

  const load = async (cursor) => {
    setPage((p) => ({ ...p, loading: true }));
    const r = await base44.entities.RdLead.filter(query, { sort: "-source_created_at", limit: 50, cursor: cursor || undefined });
    setPage((p) => ({ items: cursor ? [...p.items, ...r.items] : r.items, cursor: r.has_more ? r.next_cursor : null, loading: false }));
  };
  useEffect(() => { load(null); }, [key]);

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-white">Rastreabilidade dos registros</p>
        <button onClick={async () => { setExporting(true); await exportRdTrace(query); setExporting(false); }} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800">
          {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Exportar CSV
        </button>
      </div>
      <div className="overflow-x-auto max-h-[560px]">
        <table className="text-xs text-gray-300">
          <thead><tr><th className="text-left">Fonte</th><th className="text-left">Nome / contato</th><th className="text-left">Campanha · origem</th><th className="text-left">Etapa</th><th className="text-left">Entrada</th><th className="text-left">Correspondência</th><th className="text-left">Cliente ERP</th><th className="text-right">Receita pós-lead</th><th /></tr></thead>
          <tbody>
            {page.items.map((l) => {
              const [lbl, cls] = MATCH_LABEL[l.match_status] || MATCH_LABEL.pending;
              return (
                <tr key={l.id}>
                  <td className="whitespace-nowrap">{PRODUCT_LABEL[l.product]}</td>
                  <td><p className="text-gray-100">{l.name || "—"}</p><p className="text-gray-500">{l.email || l.phone || "sem identificador"}</p></td>
                  <td className="max-w-[200px] truncate" title={`${l.campaign} · ${l.origin}`}>{[l.campaign, l.origin].filter(Boolean).join(" · ") || "—"}</td>
                  <td>{l.stage || "—"}{l.deal_status && l.deal_status !== "open" ? ` (${l.deal_status === "won" ? "ganha" : "perdida"})` : ""}</td>
                  <td className="whitespace-nowrap">{l.source_created_at ? new Date(l.source_created_at).toLocaleDateString("pt-BR") : "—"}</td>
                  <td><span className={`px-2 py-0.5 rounded-full whitespace-nowrap ${cls}`}>{lbl}</span>{l.match_method && <span className="text-gray-600 ml-1">{l.match_method}</span>}</td>
                  <td>{l.erp_cd_pessoa ? `${l.erp_cd_pessoa} · ${l.erp_nm_pessoa}` : "—"}</td>
                  <td className="text-right">{l.erp_receita_pos_lead ? fmtCur(l.erp_receita_pos_lead) : "—"}</td>
                  <td>{REVIEW.includes(l.match_status) && <button onClick={() => setReview(l)} className="text-purple-400 hover:text-purple-300">Revisar</button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!page.loading && page.items.length === 0 && <p className="text-xs text-gray-500 text-center py-8">Nenhum registro com estes filtros. Sincronize as fontes na aba Conexões.</p>}
      </div>
      {page.loading ? <p className="text-xs text-gray-500 text-center pt-3 flex items-center justify-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando…</p>
        : page.cursor && <button onClick={() => load(page.cursor)} className="w-full mt-3 text-xs py-2 rounded-lg border border-gray-800 text-gray-400 hover:bg-gray-800">Carregar mais</button>}
      {review && <RdMatchDialog lead={review} onClose={() => setReview(null)} onSaved={() => { setReview(null); load(null); onChanged(); }} />}
    </div>
  );
}