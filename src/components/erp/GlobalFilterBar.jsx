import { useGlobalFilter } from "@/lib/GlobalFilterContext";
import { useErpSnapshot } from "@/lib/ErpSnapshotContext";
import DataSourceDropdown from "./DataSourceDropdown";
import EmpresaFilter from "./EmpresaFilter";
import PeriodFilter from "./PeriodFilter";
import { Filter, Loader2 } from "lucide-react";

// Barra de filtro GLOBAL unificada: Fonte → Empresa → Período → Aplicar.
// "Aplicar filtros" comita o período E dispara o processamento dos indicadores
// para esse período — os cards são calculados no servidor, então precisam do reload.
export default function GlobalFilterBar() {
  const { hasPendingPeriod, applyFilters, draftRange } = useGlobalFilter();
  const { refreshing, refresh } = useErpSnapshot();

  const handleApply = async () => {
    applyFilters();
    try { await refresh({ period: draftRange }); } catch (e) { /* erro exibido no header */ }
  };

  return (
    <div className="flex flex-wrap items-end gap-4">
      <DataSourceDropdown />
      <EmpresaFilter />
      <PeriodFilter />
      <button
        onClick={handleApply}
        disabled={!hasPendingPeriod || refreshing}
        className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors h-[38px]"
        title={hasPendingPeriod ? "Aplicar período e recalcular indicadores" : "Período já aplicado"}
      >
        {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Filter className="w-4 h-4" />}
        {refreshing ? "Calculando..." : "Aplicar filtros"}
      </button>
    </div>
  );
}