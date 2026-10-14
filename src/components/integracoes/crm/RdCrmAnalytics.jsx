import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2 } from "lucide-react";
import CrmBreakdown from "./CrmBreakdown";

const STATUS = { open: "Em andamento", paused: "Pausada", won: "Ganha", lost: "Perdida" };
const MATCH = { matched: "Vinculado", manual: "Vínculo manual", ambiguous: "Ambíguo", unmatched: "Sem correspondência", no_identity: "Sem identificador", pending: "Pendente", rejected: "Rejeitado" };
const brl = (v) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const ago = () => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return d.toISOString().slice(0, 10); };

// Análise do funil CRM sincronizado + cruzamento com receita ERP (só vínculos confiáveis).
export default function RdCrmAnalytics() {
  const [start, setStart] = useState(ago());
  const [end, setEnd] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState(null);

  useEffect(() => {
    setData(null);
    const query = { product: "crm_deal", source_created_at: { $gte: start, $lt: `${end}T99` } };
    const agg = (groupBy) => base44.entities.RdLead.aggregate({ query, groupBy, sum: ["amount"], sort: "-count" }).then((r) => r.rows || []);
    Promise.all([
      agg("stage"), agg("pipeline"), agg("owner"), agg("deal_status"), agg("match_status"),
      base44.entities.RdLead.aggregate({ query: { ...query, deal_status: "won", match_status: { $in: ["matched", "manual"] } }, sum: ["erp_receita_pos_lead"], countDistinct: "erp_cd_pessoa" }).then((r) => r.rows?.[0] || {}),
    ]).then(([stage, pipeline, owner, status, match, erp]) => setData({ stage, pipeline, owner, status, match, erp }));
  }, [start, end]);

  const won = data?.status.find((r) => r.deal_status === "won");
  const total = data?.status.reduce((a, r) => a + r.count, 0) || 0;
  const linked = data?.match.filter((r) => ["matched", "manual"].includes(r.match_status)).reduce((a, r) => a + r.count, 0) || 0;
  const kpis = data && [
    ["Negociações", total], ["Ganhas", `${won?.count || 0} · ${brl(won?.sum_amount)}`],
    ["Vinculadas ao ERP", `${linked} de ${total}`], ["Receita ERP pós-lead (ganhas)", brl(data.erp.sum_erp_receita_pos_lead)],
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Análise do funil CRM</h2>
          <p className="mt-1 text-xs text-gray-500">Negociações criadas no período · escopo: todas as empresas</p>
        </div>
        <div className="flex gap-2 text-xs">
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="rounded-lg border border-gray-700 bg-gray-900 px-2 py-1.5 text-gray-200" />
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="rounded-lg border border-gray-700 bg-gray-900 px-2 py-1.5 text-gray-200" />
        </div>
      </div>
      {!data ? <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-violet-400" /></div> : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {kpis.map(([l, v]) => (
              <div key={l} className="rounded-2xl border border-gray-800 bg-gray-900/40 p-4">
                <p className="text-[11px] uppercase tracking-wider text-gray-500">{l}</p>
                <p className="mt-1 text-lg font-semibold text-white">{v}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            <CrmBreakdown title="Por etapa" rows={data.stage} field="stage" />
            <CrmBreakdown title="Por funil" rows={data.pipeline} field="pipeline" />
            <CrmBreakdown title="Por responsável" rows={data.owner} field="owner" />
            <CrmBreakdown title="Por status" rows={data.status} field="deal_status" labels={STATUS} />
            <CrmBreakdown title="Correspondência com ERP" rows={data.match} field="match_status" labels={MATCH} />
          </div>
          <p className="text-[11px] leading-relaxed text-gray-500">
            Receita ERP: soma da receita pós-lead de negociações ganhas com vínculo confiável (automático ou manual) a {data.erp.count_distinct_erp_cd_pessoa ?? data.erp.countDistinct_erp_cd_pessoa ?? "—"} clientes ERP distintos. Negociações ambíguas, sem correspondência ou sem identificador não entram. Um mesmo cliente com várias negociações ganhas pode ter a receita somada mais de uma vez. Rode “Vincular ao ERP” após cada sincronização.
          </p>
        </>
      )}
    </div>
  );
}