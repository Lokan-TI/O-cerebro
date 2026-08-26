import EmailFlowsExport from "@/components/growth/EmailFlowsExport";
import { Mail } from "lucide-react";

export default function FluxosEmail() {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
          <Mail className="w-5 h-5 text-purple-400" /> Fluxos de e-mail — segmentação de clientes
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Base segmentada a partir do ERP em 5 fluxos: boas-vindas, nutrição técnica, interesse comercial,
          recuperação e pós-locação. O arquivo Excel traz uma aba por fluxo.
        </p>
      </div>
      <EmailFlowsExport />
    </div>
  );
}