import { Building2 } from "lucide-react";
import { getEmpresaLabel } from "@/lib/empresaLabels";

export default function EmpresaFilter({ empresas, selected, onChange }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 text-gray-400">
        <Building2 className="w-4 h-4" />
        <span className="text-sm font-medium">Empresa:</span>
      </div>
      <select
        value={selected ?? ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        className="bg-gray-900 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500 cursor-pointer"
      >
        <option value="">Todas as empresas (comparativo)</option>
        {empresas.map(emp => (
          <option key={emp.cd_empresa} value={emp.cd_empresa}>
            {getEmpresaLabel(emp.cd_empresa, emp.nm_empresa)} — Cod. {emp.cd_empresa}
          </option>
        ))}
      </select>
    </div>
  );
}