import { getEmpresaLabel } from "@/lib/empresaLabels";
import { Building2 } from "lucide-react";

export default function EmpresaSelect({ value, onChange, options }) {
  return (
    <div className="relative">
      <Building2 className="w-4 h-4 text-purple-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        className="appearance-none pl-8 pr-6 py-2 bg-gray-900 border border-gray-800 hover:border-purple-500 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500 min-w-[220px] cursor-pointer"
      >
        <option value="">Geral — todas as empresas</option>
        {options.map((e) => (
          <option key={e.cd_empresa} value={e.cd_empresa}>
            {getEmpresaLabel(e.cd_empresa, e.nm_empresa)}
          </option>
        ))}
      </select>
    </div>
  );
}