import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { loadAll, buildModel } from "@/lib/rdJourney";
import RdSourceStatus from "./RdSourceStatus";
import RdMcKpis from "./RdMcKpis";
import RdCampaignTable from "./RdCampaignTable";
import RdJourneyList from "./RdJourneyList";
import RdCommercialPanel from "./RdCommercialPanel";
import RdCustomKpis from '@/components/erp/rdmc/RdCustomKpis';
import RdPendingKpis from '@/components/erp/rdmc/RdPendingKpis';
import RdProposalGaps from '@/components/erp/rdmc/RdProposalGaps';

const today = new Date().toISOString().slice(0, 10);

export default function TabRdMarketingCrm() {
  const [start, setStart] = useState(`${today.slice(0, 4)}-01-01`);
  const [end, setEnd] = useState(today);
  const [model, setModel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [campaign, setCampaign] = useState(null);

  useEffect(() => {
    setLoading(true);
    // Leads: coorte pela criação no período. Negociações: todas, para seguir a jornada até o fechamento.
    Promise.all([loadAll("marketing", start, end), loadAll("crm_deal")])
      .then(([leads, deals]) => setModel(buildModel(leads, deals)))
      .finally(() => setLoading(false));
  }, [start, end]);

  return (
    <div className="space-y-4">
      <RdCommercialPanel />
      <RdCustomKpis />
      <RdPendingKpis />
      <RdProposalGaps />
      <div className="border-t border-gray-800 pt-4" />
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-gray-400">Lead criado de<input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="block mt-1 bg-gray-900 border border-gray-700 rounded-md px-2 h-8 text-gray-200" /></label>
        <label className="text-xs text-gray-400">até<input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="block mt-1 bg-gray-900 border border-gray-700 rounded-md px-2 h-8 text-gray-200" /></label>
        <RdSourceStatus />
      </div>
      <p className="text-[11px] text-gray-500">Regra temporal: o período filtra a data de criação do lead no Marketing; negociações e fechamentos são acompanhados até hoje. Vínculo por identidade normalizada (e-mail → telefone → documento). Apenas vínculos confiáveis contam como venda atribuída; "valor ganho no CRM" difere da receita reconhecida no ERP.</p>
      {loading || !model ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-10 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Carregando leads e negociações…</div>
      ) : (
        <>
          <RdMcKpis k={model.kpis} />
          <RdCampaignTable rows={model.campaigns} active={campaign} onPick={setCampaign} />
          <RdJourneyList journeys={model.journeys} campaign={campaign} />
        </>
      )}
    </div>
  );
}