import { brl } from "@/lib/rdJourney";

const pct = (a, b) => (b ? `${((a / b) * 100).toFixed(1)}%` : "—");

export default function RdCampaignTable({ rows, onPick, active }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="px-4 py-3 text-sm font-semibold text-white">Desempenho de campanhas <span className="text-xs font-normal text-gray-500">· clique para filtrar a jornada</span></div>
      <div className="overflow-auto max-h-96">
        <table className="text-xs">
          <thead><tr className="text-gray-400 text-left"><th>Campanha</th><th>Origem</th><th className="text-right">Leads</th><th className="text-right">Negociação</th><th className="text-right">Ganhas</th><th className="text-right">Conversão</th><th className="text-right">Valor CRM</th><th className="text-right">Receita ERP</th><th className="text-right">Sem atribuição</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.campaign} onClick={() => onPick(active === r.campaign ? null : r.campaign)} className={`cursor-pointer text-gray-200 ${active === r.campaign ? "bg-purple-900/30" : ""}`}>
                <td className={r.campaign === "(sem campanha)" ? "text-amber-400" : ""}>{r.campaign}</td>
                <td className="text-gray-400">{r.origin}</td>
                <td className="text-right">{r.leads}</td>
                <td className="text-right">{r.deals}</td>
                <td className="text-right">{r.won}</td>
                <td className="text-right">{pct(r.won, r.leads)}</td>
                <td className="text-right">{brl(r.amount)}</td>
                <td className="text-right">{brl(r.erp)}</td>
                <td className="text-right text-amber-400">{r.ambiguous + r.noId || ""}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={9} className="text-center text-gray-500 py-6">Nenhum lead no período.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}