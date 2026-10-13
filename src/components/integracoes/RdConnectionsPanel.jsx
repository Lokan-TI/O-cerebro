import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import RdProductCard from "./RdProductCard";
import RdErpMatchCard from "./RdErpMatchCard";
import RdSyncHistory from "./RdSyncHistory";

const PRODUCTS = [
  ["marketing", "RD Station Marketing", "Contatos/leads da segmentação 'Todos os contatos', com data de criação e estágio do funil. Usa a conexão OAuth da aba Avançado ou o token de renovação salvo."],
  ["crm", "RD Station CRM", "Negociações (etapa, funil, origem, campanha, valor, ganha/perdida) e contatos. A API do CRM precisa estar liberada na conta."],
  ["conversas", "RD Station Conversas", "Atendimentos de WhatsApp dos últimos 24 meses: contato, telefone, canal, tabulação e atendente. O conteúdo das mensagens não é liberado pela API."],
];

export default function RdConnectionsPanel() {
  const [runs, setRuns] = useState([]);
  const load = () => base44.entities.RdSyncRun.list("-created_date", 30).then(setRuns);
  useEffect(() => { load(); }, []);
  const last = (p) => runs.find((r) => r.product === p);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {PRODUCTS.map(([p, l, d]) => <RdProductCard key={p} product={p} label={l} description={d} lastRun={last(p)} onChange={load} />)}
        <RdErpMatchCard onChange={load} />
      </div>
      <RdSyncHistory runs={runs} />
    </div>
  );
}