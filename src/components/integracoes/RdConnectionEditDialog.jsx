import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

const field = "w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white";
const TOKEN_LABEL = { crm: "Token da instância do CRM", conversas: "Token JWT do Conversas", marketing: "Refresh token do Marketing" };

export default function RdConnectionEditDialog({ conn, defaultLabel, onClose, onSaved }) {
  const [label, setLabel] = useState(conn.label || "");
  const [notes, setNotes] = useState(conn.notes || "");
  const [token, setToken] = useState("");
  const [clear, setClear] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setBusy(true); setError("");
    try {
      await base44.functions.invoke("rdApiConnection", { action: "save", product: conn.product, label, notes, token, clear_token: clear });
      onSaved();
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white">
        <DialogHeader><DialogTitle>Editar conexão · {defaultLabel}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500">Nome exibido</label>
            <input className={field} value={label} onChange={(e) => setLabel(e.target.value)} placeholder={defaultLabel} />
          </div>
          <div>
            <label className="text-xs text-gray-500">{TOKEN_LABEL[conn.product]}</label>
            <input type="password" autoComplete="new-password" className={field} value={token} disabled={clear}
              onChange={(e) => setToken(e.target.value)}
              placeholder={conn.has_token ? "•••••••• (credencial salva — preencha para substituir)" : "Em branco = usa o segredo do ambiente"} />
            {conn.has_token && (
              <label className="flex items-center gap-2 text-xs text-gray-400 mt-2">
                <input type="checkbox" checked={clear} onChange={(e) => setClear(e.target.checked)} /> Voltar a usar o segredo do ambiente
              </label>
            )}
          </div>
          <div>
            <label className="text-xs text-gray-500">Observações</label>
            <textarea className={field} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-700 text-gray-300">Cancelar</button>
            <button onClick={save} disabled={busy} className="px-4 py-2 text-sm rounded-lg bg-purple-600 text-white inline-flex items-center gap-2 disabled:opacity-50">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Salvar
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}