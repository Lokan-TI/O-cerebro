import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, ShieldCheck, Save, CheckCircle2, XCircle } from "lucide-react";

const FIELDS = {
  crm: [["client_id", "Client ID"], ["client_secret", "Client Secret"]],
  marketing: [["client_id", "Client ID"], ["client_secret", "Client Secret"]],
  conversas: [["token", "Token da API do Conversas"]],
};

// Formulário de credenciais de um produto RD: salvar (só no servidor) e testar.
export default function RdCredentialForm({ product, title, conn, onTested, hideTest }) {
  const [vals, setVals] = useState({});
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(null);
  const saved = (f) => (f === "token" ? conn?.has_token : conn?.[`has_${f}`]);

  const save = async () => {
    setBusy("save"); setMsg(null);
    const { data } = await base44.functions.invoke("rdApiConnection", { action: "save", product, ...vals });
    setBusy(""); setVals({});
    setMsg(data?.ok ? { ok: true, text: "Credenciais salvas. Agora teste a conexão." } : { ok: false, text: data?.error });
    onTested(null, true);
  };
  const test = async () => {
    setBusy("test"); setMsg(null);
    const { data } = await base44.functions.invoke("rdSync", { product, action: "test" });
    setBusy("");
    setMsg({ ok: !!data?.ok, text: data?.ok ? "Conexão validada." : `Falha (HTTP ${data?.status ?? "—"}): ${data?.message || data?.error || ""}` });
    onTested(!!data?.ok);
  };
  const ready = FIELDS[product].every(([f]) => vals[f]?.trim() || saved(f));

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-4 space-y-3">
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="text-[11px] text-gray-500">Credencial confidencial: fica guardada apenas no servidor e nunca é exibida novamente. Para trocar, cole um novo valor — o anterior deixa de ser usado.</p>
      {FIELDS[product].map(([f, label]) => (
        <label key={f} className="block text-xs text-gray-400">
          {label} {saved(f) && <span className="text-emerald-400">· salvo</span>}
          <input type="password" autoComplete="off" value={vals[f] || ""} placeholder={saved(f) ? "•••••• (deixe vazio para manter)" : "Cole aqui"}
            onChange={(e) => setVals({ ...vals, [f]: e.target.value })}
            className="mt-1 w-full rounded-lg bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500" />
        </label>
      ))}
      <div className="flex gap-2">
        <button onClick={save} disabled={!!busy || !Object.values(vals).some((v) => v?.trim())} className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-40">
          {busy === "save" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Salvar
        </button>
        {!hideTest && <button onClick={test} disabled={!!busy || !ready} className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800 disabled:opacity-40">
          {busy === "test" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />} Testar conexão
        </button>}
      </div>
      {msg && <p className={`text-xs flex gap-1.5 break-words ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.ok ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <XCircle className="w-3.5 h-3.5 shrink-0" />}{msg.text}</p>}
    </div>
  );
}