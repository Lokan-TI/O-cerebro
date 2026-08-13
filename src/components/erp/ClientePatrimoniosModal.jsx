import ClientePatrimoniosPanel from "@/components/erp/ClientePatrimoniosPanel";
import { X, Package } from "lucide-react";

export default function ClientePatrimoniosModal({ client, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-5xl my-8">
        <div className="flex items-start justify-between p-5 border-b border-gray-800">
          <div>
            <h3 className="text-white font-semibold flex items-center gap-2">
              <Package className="w-4 h-4 text-purple-400" /> Patrimônios do cliente
            </h3>
            <div className="text-sm text-gray-400 mt-1">{client.nm_pessoa} <span className="text-gray-600">· #{client.cd_pessoa}</span></div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5">
          <ClientePatrimoniosPanel cdPessoa={client.cd_pessoa} />
        </div>
      </div>
    </div>
  );
}