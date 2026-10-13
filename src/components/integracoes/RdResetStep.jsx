import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Trash2, CheckCircle2, XCircle } from "lucide-react";

// Etapa 1: limpa leads, histórico, OAuth e credenciais de CRM/Marketing (Conversas preservado).
export default function RdResetStep({ onDone }) {
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const run = async () => {
    setBusy(true);
    const { data } = await base44.functions.invoke("rdApiConnection", { action: "reset", confirm: true });
    setBusy(false); setResult(data);
    if (data?.ok) onDone(data);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-300">Serão apagados de forma permanente: leads e negociações sincronizados do CRM e do Marketing, o histórico dessas sincronizações, a autorização OAuth e as credenciais salvas no Cérebro. O RD Conversas e as demais fontes não são afetados.</p>
      <label className="flex items-center gap-2 text-sm text-gray-400">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="accent-purple-500" />
        Entendo que esta exclusão não pode ser desfeita.
      </label>
      <button onClick={run} disabled={!agree || busy} className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white disabled:opacity-40">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Limpar e começar do zero
      </button>
      {result?.steps && (
        <ul className="text-xs space-y-1">
          {result.steps.map((s) => (
            <li key={s.name} className={`flex gap-1.5 ${s.ok ? "text-emerald-400" : "text-red-400"}`}>
              {s.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
              {s.name}: {s.ok ? `${s.count} removido(s)` : s.error}
            </li>
          ))}
        </ul>
      )}
      {result?.error && <p className="text-xs text-red-400">{result.error}</p>}
    </div>
  );
}