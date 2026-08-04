import { AlertCircle, Clock, Database } from "lucide-react";
import { formatDateTime } from "@/lib/erpSync";

export default function SyncConfirmDialog({ open, onClose, onConfirm, sourceName, lastUpdate, recordCount }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-white font-bold text-lg mb-1">Confirmar atualização</h2>
        <p className="text-gray-400 text-sm mb-4">
          Deseja atualizar os dados da fonte <span className="text-purple-400 font-medium">{sourceName}</span>?
        </p>
        <div className="space-y-3 mb-5">
          <InfoRow icon={Clock} label="Última atualização" value={formatDateTime(lastUpdate)} />
          <InfoRow icon={Database} label="Registros aproximados" value={recordCount != null ? recordCount.toLocaleString("pt-BR") : "—"} />
          <InfoRow icon={AlertCircle} label="Versão atual" value="Permanecerá disponível durante o processamento" />
        </div>
        <div className="bg-gray-800 rounded-lg p-3 mb-5">
          <p className="text-gray-400 text-xs">
            A extração ocorrerá em segundo plano. Você poderá continuar navegando e consultar os dados da versão anterior enquanto a nova versão é processada.
          </p>
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 rounded-lg text-sm transition-colors">
            Cancelar
          </button>
          <button onClick={onConfirm} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors">
            Iniciar atualização
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="w-4 h-4 text-gray-500 shrink-0" />
      <div>
        <p className="text-gray-500 text-xs">{label}</p>
        <p className="text-gray-300 text-sm">{value}</p>
      </div>
    </div>
  );
}