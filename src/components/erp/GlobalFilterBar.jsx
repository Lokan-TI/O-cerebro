import { useGlobalFilter } from "@/lib/GlobalFilterContext";
import DataSourceDropdown from "./DataSourceDropdown";
import EmpresaFilter from "./EmpresaFilter";
import PeriodFilter from "./PeriodFilter";
import { Filter } from "lucide-react";

// Barra de filtro GLOBAL unificada: Fonte → Empresa → Período → Aplicar.
// Substitui a linha de dropdowns soltos no RefreshHeader. Fonte e Empresa aplicam
// imediatamente; Período é confirmado com "Aplicar filtros".
export default function GlobalFilterBar() {
  const { hasPendingPeriod, applyFilters } = useGlobalFilter();

  return (
    <div className="flex flex-wrap items-end gap-4">
      <DataSourceDropdown />
      <EmpresaFilter />
      <PeriodFilter />
      <button
        onClick={applyFilters}
        disabled={!hasPendingPeriod}
        className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors h-[38px]"
        title={hasPendingPeriod ? "Aplicar período selecionado" : "Período já aplicado"}
      >
        <Filter className="w-4 h-4" />
        Aplicar filtros
      </button>
    </div>
  );
}