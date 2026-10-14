import { useState } from "react";
import { Input } from "@/components/ui/input";
import { LINK_LABEL, brl, dt } from "@/lib/rdJourney";
import RdJourneyDialog from "./RdJourneyDialog";

export default function RdJourneyList({ journeys, campaign }) {
  const [q, setQ] = useState("");
  const [link, setLink] = useState("");
  const [open, setOpen] = useState(null);
  const [limit, setLimit] = useState(50);
  const s = q.toLowerCase();
  const rows = journeys.filter((j) => (!campaign || (j.lead.campaign || "(sem campanha)") === campaign) && (!link || j.link === link) && (!s || `${j.lead.name} ${j.lead.email} ${j.lead.company_name}`.toLowerCase().includes(s)));
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="px-4 py-3 flex flex-wrap items-center gap-2">
        <div className="text-sm font-semibold text-white mr-auto">Jornada por lead {campaign && <span className="text-xs text-purple-300">· {campaign}</span>} <span className="text-xs text-gray-500">({rows.length})</span></div>
        <select value={link} onChange={(e) => setLink(e.target.value)} className="bg-gray-950 border border-gray-700 rounded-md text-xs text-gray-200 h-8 px-2">
          <option value="">Todos os vínculos</option>
          {Object.entries(LINK_LABEL).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nome, e-mail, empresa" className="h-8 w-56 text-xs bg-gray-950 border-gray-700" />
      </div>
      <div className="overflow-auto max-h-[480px]">
        <table className="text-xs">
          <thead><tr className="text-left text-gray-400"><th>Lead</th><th>Campanha</th><th>Criado</th><th>Vínculo</th><th className="text-right">Negociações</th><th className="text-right">Valor ganho</th></tr></thead>
          <tbody>
            {rows.slice(0, limit).map((j, i) => {
              const [lbl, cls] = LINK_LABEL[j.link];
              return (
                <tr key={i} onClick={() => setOpen(j)} className="cursor-pointer text-gray-200">
                  <td>{j.lead.name || j.lead.email || "—"}<div className="text-gray-500">{j.lead.email}</div></td>
                  <td>{j.lead.campaign || <span className="text-amber-400">(sem campanha)</span>}</td>
                  <td>{dt(j.lead.source_created_at)}</td>
                  <td><span className={`px-1.5 py-0.5 rounded ${cls}`}>{lbl}</span></td>
                  <td className="text-right">{j.deals.length}</td>
                  <td className="text-right">{j.link === "confiavel" ? brl(j.wonAmount) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length > limit && <button onClick={() => setLimit(limit + 50)} className="w-full py-2 text-xs text-purple-400 hover:bg-gray-800">Carregar mais</button>}
      </div>
      <RdJourneyDialog j={open} onClose={() => setOpen(null)} />
    </div>
  );
}