import { ExternalLink, KeyRound, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import WizardStep from "./WizardStep";
import CopyField from "./CopyField";
import RdCredentialForm from "../RdCredentialForm";
import { useRdOAuth } from "@/lib/useRdOAuth";

const CALLBACK = "https://lokan-firstouch.base44.app/rdstation/callback";

// Marketing: único produto RD com OAuth e URL de callback oficiais.
export default function MarketingSteps({ conn, onChange }) {
  const oauth = useRdOAuth(onChange);
  const hasApp = conn?.has_client_id && conn?.has_client_secret;
  const connected = oauth.info?.status === "connected";
  return (
    <>
      <WizardStep n={1} title="Crie o App na RD Station" done={hasApp}>
        <p>Em <b className="text-gray-200">appstore.rdstation.com → Painel do desenvolvedor → Criar aplicativo</b>, escolha o tipo de integração privada e cole esta URL no campo de callback:</p>
        <CopyField label="URL de callback" value={CALLBACK} />
        <a href="https://appstore.rdstation.com/pt-BR/publisher" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-violet-300 hover:text-violet-200">Abrir portal da RD <ExternalLink className="h-3 w-3" /></a>
      </WizardStep>
      <WizardStep n={2} title="Informe as credenciais do App" done={hasApp}>
        <RdCredentialForm product="marketing" title="Client ID e Client Secret gerados pela RD" conn={conn} hideTest onTested={() => onChange()} />
      </WizardStep>
      <WizardStep n={3} title="Autorize a conta RD Station" done={connected}>
        <p>Uma janela da RD será aberta pedindo login, para você escolher a conta RD desejada. Entre com um usuário administrador e aceite o acesso.</p>
        <p className="text-xs text-gray-500">Se a RD entrar direto na conta errada: abra <a href="https://app.rdstation.com.br" target="_blank" rel="noreferrer" className="text-violet-300 underline">app.rdstation.com.br</a>, clique em Sair (menu do seu perfil) e depois clique em “Autorizar” de novo.</p>
        <button onClick={oauth.connect} disabled={!hasApp || oauth.busy} className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-40">
          {oauth.busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />} {connected ? "Autorizar novamente" : "Autorizar na RD Station"}
        </button>
        {oauth.manualUrl && <a href={oauth.manualUrl} target="_blank" rel="noreferrer" className="block text-xs text-violet-300 underline">A janela foi bloqueada — clique aqui para abrir a autorização</a>}
        {connected && <p className="flex items-center gap-1.5 text-xs text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" /> Conta autorizada{oauth.info.connected_at ? ` em ${new Date(oauth.info.connected_at).toLocaleString("pt-BR")}` : ""}. O acesso é renovado automaticamente.</p>}
        {(oauth.error || (oauth.info?.status === "error" && oauth.info.last_error)) && <p className="flex gap-1.5 text-xs text-red-400 break-words"><AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {oauth.error || oauth.info.last_error}</p>}
      </WizardStep>
    </>
  );
}