import { ExternalLink, KeyRound, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import WizardStep from "./WizardStep";
import CopyField from "./CopyField";
import RdCredentialForm from "../RdCredentialForm";
import { useRdOAuth } from "@/lib/useRdOAuth";

const CALLBACK = "https://lokan-firstouch.base44.app/rdstation/callback";

// CRM v2: OAuth 2.0 com App próprio do CRM (credenciais separadas do Marketing).
export default function CrmSteps({ conn, onChange }) {
  const oauth = useRdOAuth(onChange, "crm");
  const hasApp = conn?.has_client_id && conn?.has_client_secret;
  const connected = oauth.info?.status === "connected";
  const err = oauth.error || (oauth.info?.status === "error" && oauth.info.last_error);
  return (
    <>
      <WizardStep n={1} title="Crie o App do CRM na RD App Store" done={hasApp}>
        <p>No <b className="text-gray-200">App Publisher → Quero criar um aplicativo</b>, escolha o produto <b className="text-gray-200">RD Station CRM</b> e cadastre exatamente esta URL de callback:</p>
        <CopyField label="URL de callback" value={CALLBACK} />
        <a href="https://appstore.rdstation.com/pt-BR/publisher" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-violet-300 hover:text-violet-200">Abrir App Publisher <ExternalLink className="h-3 w-3" /></a>
      </WizardStep>
      <WizardStep n={2} title="Informe as credenciais do App do CRM" done={hasApp}>
        <p className="text-xs text-gray-500">Use o Client ID e o Client Secret do App do CRM — as credenciais do Marketing não funcionam aqui.</p>
        <RdCredentialForm product="crm" title="Client ID e Client Secret gerados pela RD" conn={conn} hideTest onTested={() => onChange()} />
      </WizardStep>
      <WizardStep n={3} title="Autorize a conta RD Station CRM" done={connected}>
        <p>Uma janela da RD será aberta para você escolher a conta do CRM e aceitar o acesso. O acesso dura 2 horas e é renovado automaticamente; se ficar 14 dias sem uso, será preciso autorizar de novo.</p>
        <button onClick={oauth.connect} disabled={!hasApp || oauth.busy} className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-40">
          {oauth.busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />} {connected ? "Autorizar novamente" : "Autorizar na RD Station"}
        </button>
        {oauth.manualUrl && <a href={oauth.manualUrl} target="_blank" rel="noreferrer" className="block text-xs text-violet-300 underline">A janela foi bloqueada — clique aqui para abrir a autorização</a>}
        {connected && <p className="flex items-center gap-1.5 text-xs text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" /> Conta CRM autorizada{oauth.info.connected_at ? ` em ${new Date(oauth.info.connected_at).toLocaleString("pt-BR")}` : ""}.</p>}
        {err && <p className="flex gap-1.5 text-xs text-red-400 break-words"><AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {err}</p>}
      </WizardStep>
    </>
  );
}