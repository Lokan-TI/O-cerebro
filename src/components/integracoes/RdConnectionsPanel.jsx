import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import RdProductCard from "./RdProductCard";
import RdErpMatchCard from "./RdErpMatchCard";
import RdSyncHistory from "./RdSyncHistory";
import RdConnectionActions from "./RdConnectionActions";
import RdRemovedConnections from "./RdRemovedConnections";
import RdReconfigWizard from "./RdReconfigWizard";
import RdAuditMatrix from "./RdAuditMatrix";
import { useRdConnections } from "@/lib/useRdConnections";

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
  const { connections, byProduct, reload, envSecrets } = useRdConnections();
  const refresh = () => { reload(); load(); };
  const labels = Object.fromEntries(PRODUCTS.map(([p, l]) => [p, l]));

  return (
    <div className="space-y-6">
      <RdAuditMatrix />
      <RdReconfigWizard byProduct={byProduct} envSecrets={envSecrets} lastRun={last} onChange={refresh} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {PRODUCTS.filter(([p]) => !byProduct(p)?.removed).map(([p, l, d]) => (
          <RdProductCard key={p} product={p} label={byProduct(p)?.label || l} description={d} lastRun={last(p)} onChange={load}
            actions={<RdConnectionActions conn={byProduct(p)} defaultLabel={l} onChange={refresh} />} />
        ))}
        <RdErpMatchCard onChange={load} />
      </div>
      <RdRemovedConnections removed={connections.filter((c) => c.removed)} labels={labels} onChange={refresh} />
      <RdSyncHistory runs={runs} />
    </div>
  );
}