import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LINK_LABEL, brl, dt } from "@/lib/rdJourney";

export default function RdJourneyDialog({ j, onClose }) {
  if (!j) return null;
  const l = j.lead;
  const [lbl, cls] = LINK_LABEL[j.link];
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-gray-950 border-gray-800 text-white max-h-[85vh] overflow-auto">
        <DialogHeader><DialogTitle>{l.name || l.email || "Lead"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-2 text-xs text-gray-300">
          <div>Campanha: <b>{l.campaign || "—"}</b></div><div>Origem: <b>{l.origin || "—"}</b></div>
          <div>Lead criado: <b>{dt(l.source_created_at)}</b></div><div>Empresa: <b>{l.company_name || "—"}</b></div>
          <div className="col-span-2">Identidade usada: <b>{j.key || "nenhuma (sem e-mail, telefone ou documento)"}</b></div>
          <div>Vínculo CRM: <span className={`px-1.5 py-0.5 rounded ${cls}`}>{lbl}</span></div>
          <div>Cliente ERP: <b>{["matched", "manual"].includes(l.match_status) ? `${l.erp_nm_pessoa} · ${brl(l.erp_receita_pos_lead)}` : l.match_status || "pendente"}</b></div>
        </div>
        {j.link === "ambiguo" && <p className="text-xs text-amber-400">Esta identidade aparece em mais de uma campanha — as negociações não são atribuídas a esta campanha.</p>}
        <div className="space-y-2 mt-2">
          <div className="text-sm font-semibold">Negociações no CRM ({j.deals.length})</div>
          {j.deals.map((d, i) => (
            <div key={i} className="border border-gray-800 rounded-lg p-3 text-xs grid grid-cols-2 gap-1 text-gray-300">
              <div className="col-span-2 text-white font-medium">{d.name || "Negociação"}</div>
              <div>Funil/etapa: {d.pipeline || "—"} · {d.stage || "—"}</div><div>Status: {d.deal_status || "—"}</div>
              <div>Valor: {brl(d.amount)}</div><div>Responsável: {d.owner || "—"}</div>
              <div>Criada: {dt(d.source_created_at)}</div><div>Fechada: {dt(d.closed_at)}</div>
            </div>
          ))}
          {!j.deals.length && <p className="text-xs text-gray-500">Nenhuma negociação encontrada para esta identidade.</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}