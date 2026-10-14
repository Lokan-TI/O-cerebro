import { brl } from "@/lib/rdJourney";

const pct = (a, b) => (b ? `${((a / b) * 100).toFixed(1)}%` : "—");

export default function RdMcKpis({ k }) {
  const cards = [
    ["Leads (Marketing)", k.leads.toLocaleString("pt-BR"), "criados no período"],
    ["Com negociação", k.withDeal.toLocaleString("pt-BR"), `${pct(k.withDeal, k.leads)} dos leads · vínculo confiável`],
    ["Vendas ganhas", k.won.toLocaleString("pt-BR"), `${pct(k.won, k.withDeal)} das negociações`],
    ["Valor ganho no CRM", brl(k.amount), "soma das negociações ganhas"],
    ["Receita no ERP", brl(k.erp), "faturada após o lead, cliente vinculado"],
    ["Sem atribuição confiável", (k.ambiguous + k.noId).toLocaleString("pt-BR"), `${k.ambiguous} ambíguos · ${k.noId} sem identidade`],
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      {cards.map(([t, v, s]) => (
        <div key={t} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-[11px] uppercase tracking-wide text-gray-500">{t}</div>
          <div className="text-xl font-semibold text-white mt-1">{v}</div>
          <div className="text-[11px] text-gray-500 mt-1">{s}</div>
        </div>
      ))}
    </div>
  );
}