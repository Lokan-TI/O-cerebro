import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { RotateCcw } from "lucide-react";
import MarketingSteps from "./MarketingSteps";
import TokenSteps from "./TokenSteps";
import WizardStep from "./WizardStep";
import RdProductCard from "../RdProductCard";
import RdConnectionDeleteDialog from "../RdConnectionDeleteDialog";
import { useRdConnections } from "@/lib/useRdConnections";

const PRODUCTS = [
  ["marketing", "RD Station Marketing", "OAuth com callback", "Contatos/leads da segmentação 'Todos os contatos' e estágio do funil."],
  ["crm", "RD Station CRM", "Token da instância", "Negociações (etapa, funil, origem, valor, ganha/perdida) e contatos."],
  ["conversas", "RD Station Conversas", "Token de acesso", "Atendimentos de WhatsApp dos últimos 24 meses: contato, canal, tabulação e atendente."],
];

// Assistente único de conexão RD: escolha o produto → configure → autorize → sincronize.
export default function RdSetupWizard() {
  const [product, setProduct] = useState("marketing");
  const [runs, setRuns] = useState([]);
  const [confirmDel, setConfirmDel] = useState(false);
  const { byProduct, reload } = useRdConnections();
  const loadRuns = () => base44.entities.RdSyncRun.list("-created_date", 30).then(setRuns);
  useEffect(() => { loadRuns(); }, []);
  const refresh = () => { reload(); loadRuns(); };
  const conn = byProduct(product);
  const [, label, method, desc] = PRODUCTS.find((p) => p[0] === product);
  const ready = (p) => { const c = byProduct(p); return c && !c.removed && c.has_token; };
  const lastStep = product === "marketing" ? 4 : 3;

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <div className="space-y-2">
        {PRODUCTS.map(([p, l, m]) => (
          <button key={p} onClick={() => setProduct(p)} className={`w-full rounded-xl border p-4 text-left transition-all ${product === p ? "border-violet-500/60 bg-violet-500/10" : "border-gray-800 bg-gray-900/40 hover:border-gray-700"}`}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-white">{l}</p>
              <span className={`h-2 w-2 rounded-full ${ready(p) ? "bg-emerald-400" : "bg-gray-600"}`} />
            </div>
            <p className="mt-1 text-xs text-gray-500">{m} · {ready(p) ? "configurado" : "não configurado"}</p>
          </button>
        ))}
      </div>
      <div key={product} className="rounded-2xl border border-gray-800 bg-gray-900/40 p-6 animate-in fade-in duration-300">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">{label}</h2>
            <p className="mt-1 text-xs text-gray-500">{desc}</p>
          </div>
          {conn && !conn.removed && (conn.has_token || conn.has_client_id) && (
            <button onClick={() => setConfirmDel(true)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10">
              <RotateCcw className="h-3.5 w-3.5" /> Desconectar
            </button>
          )}
        </div>
        {product === "marketing" ? <MarketingSteps conn={conn} onChange={refresh} /> : <TokenSteps product={product} conn={conn} onChange={refresh} />}
        <WizardStep n={lastStep} title="Valide e sincronize os dados" done={runs.some((r) => r.product === product && r.status === "done")}>
          <RdProductCard product={product} label={label} description="Testar valida a credencial na RD; sincronizar traz os dados para o Cérebro." lastRun={runs.find((r) => r.product === product)} onChange={loadRuns} />
        </WizardStep>
      </div>
      {confirmDel && <RdConnectionDeleteDialog product={product} label={label} onClose={() => setConfirmDel(false)} onDeleted={() => { setConfirmDel(false); refresh(); }} />}
    </div>
  );
}