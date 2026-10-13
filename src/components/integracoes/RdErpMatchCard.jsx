import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Database, Loader2 } from "lucide-react";

export default function RdErpMatchCard({ onChange }) {
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [error, setError] = useState("");

  const run = async (rematch) => {
    setBusy(true); setError("");
    let first = true;
    for (;;) {
      const { data } = await base44.functions.invoke("rdMatchErp", first && rematch ? { action: "rematch" } : {});
      first = false;
      if (data.error) { setError(data.error); break; }
      setRes(data);
      if (data.done) break;
    }
    setBusy(false); onChange();
  };

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-5 flex flex-col gap-4">
      <div>
        <p className="text-white font-semibold flex items-center gap-2"><Database className="w-4 h-4 text-purple-400" /> ERP (Sisloc) · Vínculo e receita</p>
        <p className="text-xs text-gray-500 mt-1 leading-relaxed">
          Vincula cada registro RD a um cliente do ERP por documento, depois e-mail, depois telefone, e soma a receita faturada a partir do mês de entrada do lead. Quando há mais de um candidato, o registro fica como ambíguo e precisa de revisão.
        </p>
      </div>
      {res && <p className="text-xs text-gray-400">Processados: <b className="text-gray-200">{res.processed}</b> · Pendentes: <b className="text-gray-200">{res.pending}</b></p>}
      {error && <p className="text-xs text-red-400 break-words">{error}</p>}
      <div className="flex gap-2 mt-auto">
        <button onClick={() => run(false)} disabled={busy} className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50">
          {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Vincular pendentes
        </button>
        <button onClick={() => run(true)} disabled={busy} className="flex-1 text-xs px-3 py-2 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800 disabled:opacity-50">
          Reprocessar tudo
        </button>
      </div>
    </div>
  );
}