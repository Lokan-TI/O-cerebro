import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, RefreshCw, ShieldCheck } from "lucide-react";

const fmt = (d) => (d ? new Date(d).toLocaleString("pt-BR") : "—");

export default function RdProductCard({ product, label, description, lastRun, onChange }) {
  const [test, setTest] = useState(null);
  const [busy, setBusy] = useState("");
  const [progress, setProgress] = useState(null);

  const runTest = async () => {
    setBusy("test");
    const { data } = await base44.functions.invoke("rdSync", { product, action: "test" });
    setTest(data); setBusy("");
  };

  const sync = async () => {
    setBusy("sync");
    let runId = lastRun?.status === "running" ? lastRun.id : undefined;
    for (;;) {
      const { data } = await base44.functions.invoke("rdSync", { product, run_id: runId, months: 24 });
      runId = data.run?.id; setProgress(data.run);
      if (data.done) break;
    }
    setBusy(""); onChange();
  };

  const run = progress || lastRun;
  const ok = test ? test.ok : null;
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-white font-semibold">{label}</p>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">{description}</p>
        </div>
        <span className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full ${ok === true ? "bg-emerald-500/10 text-emerald-400" : ok === false ? "bg-red-500/10 text-red-400" : "bg-gray-800 text-gray-500"}`}>
          {ok === true ? "Conectado" : ok === false ? "Falha" : "Não testado"}
        </span>
      </div>
      {test && !test.ok && <p className="text-xs text-red-400/90 break-words">HTTP {test.status}: {test.message}</p>}
      <div className="text-xs text-gray-400 space-y-1 border-t border-gray-800 pt-3">
        <p>Última sincronização: <span className="text-gray-200">{fmt(run?.finished_at || run?.started_at)}</span></p>
        <p>Estado: <span className="text-gray-200">{run ? { running: "em andamento / retomável", done: "concluída", error: "erro" }[run.status] : "nunca executada"}</span> · {run?.records || 0} registros · {run?.pages || 0} páginas</p>
        {run?.last_error && <p className="text-red-400 break-words">{run.last_error}</p>}
      </div>
      <div className="flex gap-2 mt-auto">
        <button onClick={runTest} disabled={!!busy} className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800 disabled:opacity-50">
          {busy === "test" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />} Testar
        </button>
        <button onClick={sync} disabled={!!busy} className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50">
          {busy === "sync" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          {busy === "sync" ? `Sincronizando… ${progress?.records || 0}` : run?.status === "running" ? "Retomar" : "Sincronizar"}
        </button>
      </div>
    </div>
  );
}