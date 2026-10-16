import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useErpSource, ALL_SOURCES_ID } from "@/lib/ErpSourceContext";
import RdGapList from "@/components/erp/rdmc/RdGapList";

// Pendências de processo comercial: propostas citadas no CRM sem ficha no ERP e vendas sem nº de proposta.
export default function RdProposalGaps() {
  const { selectedSource } = useErpSource();
  const sourceId = selectedSource?.id && selectedSource.id !== ALL_SOURCES_ID ? selectedSource.id : undefined;
  const q = useQuery({
    queryKey: ["rdProposalGaps", sourceId],
    queryFn: async () => (await base44.functions.invoke("rdMatchErp", { action: "proposal_gaps", source_id: sourceId })).data,
    staleTime: 10 * 60 * 1000,
  });
  const d = q.data;
  return (
    <section className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-400" />
        <h3 className="text-sm font-semibold text-white">Aderência ao processo: proposta Sisloc no CRM</h3></div>
      <p className="mt-1 text-xs text-gray-500">Confere o nº de proposta informado em cada negociação RD contra as fichas da fonte ERP selecionada. Esses casos não são vinculados a nenhum cliente.</p>
      {q.isLoading && <p className="mt-4 flex items-center gap-2 text-xs text-gray-400"><Loader2 className="h-3 w-3 animate-spin" />Conferindo propostas no ERP…</p>}
      {q.isError && <p className="mt-4 text-xs text-red-400">Não foi possível conferir: {String(q.error?.message || "")}</p>}
      {d && <>
        <p className="mt-4 text-xs text-gray-400">{d.total_deals} negociações · {d.with_proposal} com nº de proposta · {d.proposals_found} propostas encontradas no ERP</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <RdGapList title="Proposta informada não existe no ERP" data={d.not_found} groupKey="by_company" groupLabel="Empresas" />
          <RdGapList title="Vendidas no RD sem nº de proposta" data={d.won_without_proposal} groupKey="by_owner" groupLabel="Vendedores" />
        </div>
      </>}
    </section>
  );
}