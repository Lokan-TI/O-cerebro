import { useGlobalFilter } from "@/lib/GlobalFilterContext";
import { useErpSnapshot } from "@/lib/ErpSnapshotContext";
import DataSourceDropdown from "./DataSourceDropdown";
import EmpresaFilter from "./EmpresaFilter";
import PeriodFilter from "./PeriodFilter";
import { Filter, Loader2 } from "lucide-react";

// Barra de filtro GLOBAL unificada: Fonte → Empresa → Período → Aplicar.
// "Aplicar filtros" apenas comita o período — as abas que consultam o ERP ao vivo já
// reagem na hora. O reprocessamento pesado do snapshot fica no botão explícito
// "Carregar dados deste período" (aviso de período), para que aplicar um filtro não
// dependa de uma extração completa que pode falhar por instabilidade do banco.
export default function GlobalFilterBar() {
  const { hasPendingPeriod, applyFilters } = useGlobalFilter();
  const { refreshing } = useErpSnapshot();

  const handleApply = () => {
    applyFilters();
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
        title={hasPendingPeriod ? "Aplicar período aos painéis" : "Período já aplicado"}
      >
        {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Filter className="w-4 h-4" />}
        {refreshing ? "Calculando..." : "Aplicar filtros"}
      </button>
    </div>
  );
}