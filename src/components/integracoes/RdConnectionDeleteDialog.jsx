import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription } from "@/components/ui/alert-dialog";
import { Loader2, AlertTriangle } from "lucide-react";

export default function RdConnectionDeleteDialog({ product, label, onClose, onDeleted }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const remove = async () => {
    setBusy(true); setError("");
    try {
      await base44.functions.invoke("rdApiConnection", { action: "delete", product, confirm: true });
      onDeleted();
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
      setBusy(false);
    }
  };

  return (
    <AlertDialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <AlertDialogContent className="bg-gray-900 border-gray-800 text-white">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-red-400" /> Excluir {label}?</AlertDialogTitle>
          <AlertDialogDescription className="text-gray-400">
            A conexão será removida e <b className="text-red-300">todos os registros sincronizados dela</b> (leads, vínculos com o ERP e histórico de sincronizações) serão apagados permanentemente. Dados das outras conexões não são afetados.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} disabled={busy} className="px-4 py-2 text-sm rounded-lg border border-gray-700 text-gray-300">Cancelar</button>
          <button onClick={remove} disabled={busy} className="px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-500 text-white inline-flex items-center gap-2 disabled:opacity-50">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} {busy ? "Excluindo…" : "Excluir conexão e dados"}
          </button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}