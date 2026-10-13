import { useState } from "react";
import { RotateCcw, X, AlertTriangle } from "lucide-react";
import RdResetStep from "./RdResetStep";
import RdCredentialForm from "./RdCredentialForm";
import RdProductCard from "./RdProductCard";

// Fluxo guiado: limpar → configurar CRM e Marketing → testar → sincronizar.
export default function RdReconfigWizard({ byProduct, envSecrets = [], lastRun, onChange }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [ok, setOk] = useState({});
  const [pending, setPending] = useState(envSecrets);
  const mark = (p) => (v, refresh) => { if (refresh) onChange(); else setOk((o) => ({ ...o, [p]: v })); };

  if (!open) return (
    <button onClick={() => { setOpen(true); setStep(1); setOk({}); }} className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg border border-purple-600/60 text-purple-300 hover:bg-purple-600/10">
      <RotateCcw className="w-4 h-4" /> Reconfigurar CRM e Marketing do zero
    </button>
  );

  return (
    <div className="rounded-2xl border border-purple-700/40 bg-gray-900/60 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-white font-semibold">Reconfiguração RD CRM e Marketing · etapa {step} de 3</p>
        <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-300"><X className="w-4 h-4" /></button>
      </div>
      {step === 1 && <RdResetStep onDone={(d) => { setPending(d.env_secrets || []); onChange(); setStep(2); }} />}
      {step >= 2 && pending.length > 0 && (
        <p className="text-xs text-amber-300 flex gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          Ainda existem segredos antigos nas configurações do app ({pending.join(", ")}). O Cérebro passou a ignorá-los, mas só podem ser apagados em Configurações do app → Secrets.</p>
      )}
      {step === 2 && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <RdCredentialForm product="crm" title="RD Station CRM" conn={byProduct("crm")} onTested={mark("crm")} />
            <RdCredentialForm product="marketing" title="RD Station Marketing" conn={byProduct("marketing")} onTested={mark("marketing")} />
          </div>
          <button onClick={() => setStep(3)} disabled={!ok.crm && !ok.marketing} className="text-sm px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-40">
            Continuar para sincronização
          </button>
        </>
      )}
      {step === 3 && (
        <div className="grid gap-4 md:grid-cols-2">
          {["crm", "marketing"].filter((p) => ok[p]).map((p) => (
            <RdProductCard key={p} product={p} label={p === "crm" ? "RD Station CRM" : "RD Station Marketing"} description="Conexão validada. Inicie a nova sincronização." lastRun={lastRun(p)} onChange={onChange} />
          ))}
        </div>
      )}
    </div>
  );
}