import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Search } from "lucide-react";
import { identityKey } from "@/lib/rdFunnelQuery";

export default function RdMatchDialog({ lead, onClose, onSaved }) {
  const [term, setTerm] = useState(lead.identity_doc || lead.name || "");
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const key = identityKey(lead);

  const search = async () => {
    setBusy("search"); setError("");
    const { data } = await base44.functions.invoke("rdMatchErp", { action: "search", term });
    if (data.error) setError(data.error); else setRows(data.rows);
    setBusy("");
  };
  const decide = async (decision, p) => {
    setBusy(decision); setError("");
    const { data } = await base44.functions.invoke("rdMatchErp", { action: "manual", identity_key: key, decision, erp_cd_pessoa: p?.cd_pessoa, erp_nm_pessoa: p?.nm_pessoa, note });
    setBusy("");
    if (data.error) setError(data.error); else onSaved();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-gray-950 border-gray-800 text-white max-w-2xl">
        <DialogHeader><DialogTitle>Revisar correspondência</DialogTitle></DialogHeader>
        <div className="text-xs text-gray-400 space-y-1">
          <p><b className="text-gray-200">{lead.name || "Sem nome"}</b> · {lead.email || "sem e-mail"} · {lead.phone || "sem telefone"} · {lead.document || "sem documento"}</p>
          <p>Identidade usada: <code className="text-purple-300">{key || "nenhuma"}</code></p>
          {lead.erp_candidates && <p className="text-amber-400">Candidatos encontrados: {lead.erp_candidates}</p>}
        </div>
        {!key ? <p className="text-sm text-red-400">Este registro não tem e-mail, telefone nem documento, então não pode ser vinculado.</p> : (
          <>
            <div className="flex gap-2">
              <input value={term} onChange={(e) => setTerm(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} placeholder="Nome, CNPJ/CPF ou código do cliente ERP"
                className="flex-1 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm" />
              <button onClick={search} disabled={!!busy} className="px-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm inline-flex items-center gap-1.5">
                {busy === "search" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Buscar
              </button>
            </div>
            {rows && (rows.length === 0 ? <p className="text-xs text-gray-500">Nenhum cliente encontrado.</p> : (
              <div className="max-h-60 overflow-y-auto divide-y divide-gray-800 border border-gray-800 rounded-lg">
                {rows.map((p) => (
                  <div key={p.cd_pessoa} className="flex items-center justify-between px-3 py-2 text-xs">
                    <span><b>{p.cd_pessoa}</b> · {p.nm_pessoa} <span className="text-gray-500">{p.doc}</span></span>
                    <button onClick={() => decide("link", p)} disabled={!!busy} className="px-2.5 py-1 rounded-md bg-purple-600 hover:bg-purple-500">Vincular</button>
                  </div>
                ))}
              </div>
            ))}
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Observação para auditoria (opcional)" className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm" />
            <button onClick={() => decide("no_match")} disabled={!!busy} className="self-start text-xs px-3 py-2 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800">
              {busy === "no_match" ? "Salvando…" : "Marcar como sem cliente no ERP"}
            </button>
          </>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}