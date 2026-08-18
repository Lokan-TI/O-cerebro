import { useEmpresaFilter } from "@/lib/EmpresaFilterContext";
import { getEmpresaLabel } from "@/lib/empresaLabels";
import { filterEmpresaRows } from "@/lib/empresaScope";
import { Building2, Check } from "lucide-react";

// Filtro GLOBAL de empresa — presente no cabeçalho, persiste entre todas as abas.
export default function EmpresaFilter() {
  const { selectedEmpresa, setSelectedEmpresa, empresaList } = useEmpresaFilter();

  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-gray-500 text-xs uppercase tracking-wider">Empresa</label>
      <div className="relative">
        <Building2 className="w-4 h-4 text-purple-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <select
          value={selectedEmpresa ?? ""}
          onChange={(e) => setSelectedEmpresa(e.target.value ? Number(e.target.value) : null)}
          className="appearance-none pl-8 pr-8 py-2 bg-gray-900 hover:bg-gray-800 border border-gray-700 hover:border-purple-500 rounded-lg text-sm text-white font-medium focus:outline-none focus:border-purple-500 min-w-[240px] cursor-pointer transition-colors"
        >
          <option value="">Todas as empresas</option>
          {filterEmpresaRows(empresaList).map((e) => (
            <option key={e.cd_empresa} value={e.cd_empresa}>
              {getEmpresaLabel(e.cd_empresa, e.nm_empresa)}
            </option>
          ))}
        </select>
        <Check className="w-3.5 h-3.5 text-purple-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
      <p className="text-gray-600 text-xs">
        {selectedEmpresa == null
          ? "Consolidado de todas as empresas"
          : "Filtro aplicado a todos os dashboards"}
      </p>
    </div>
  );
}