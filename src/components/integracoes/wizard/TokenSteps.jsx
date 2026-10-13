import { Info } from "lucide-react";
import WizardStep from "./WizardStep";
import RdCredentialForm from "../RdCredentialForm";

const GUIDE = {
  crm: {
    why: "A API do RD Station CRM usada pelo Cérebro (v1) não tem App nem URL de callback: ela autentica por token da instância.",
    where: "No CRM, acesse Perfil (canto superior) → Integrações → Token da instância. Gere o token com um usuário administrador, para que todas as negociações fiquem visíveis.",
  },
  conversas: {
    why: "O RD Station Conversas não oferece App nem URL de callback: a API autentica por token de acesso.",
    where: "No Conversas, acesse Configurações → Integrações → API e copie o token de acesso.",
  },
};

// CRM e Conversas: autenticação por token (sem OAuth oficial equivalente).
export default function TokenSteps({ product, conn, onChange }) {
  const g = GUIDE[product];
  return (
    <>
      <WizardStep n={1} title="Gere o token na RD Station" done={conn?.has_token}>
        <p className="flex gap-2 rounded-lg border border-sky-500/20 bg-sky-500/5 p-3 text-xs text-sky-200"><Info className="h-4 w-4 shrink-0" /> {g.why}</p>
        <p>{g.where}</p>
      </WizardStep>
      <WizardStep n={2} title="Salve e valide o token" done={conn?.has_token}>
        <RdCredentialForm product={product} title="Token" conn={conn} onTested={() => onChange()} />
      </WizardStep>
    </>
  );
}