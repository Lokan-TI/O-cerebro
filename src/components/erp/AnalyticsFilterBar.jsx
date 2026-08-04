import { useErpAnalytics } from "@/lib/ErpAnalyticsContext";
import { getEmpresaLabel } from "@/lib/empresaLabels";

export default function AnalyticsFilterBar() {
  const { data, year, setYear, empresaFilter, setEmpresaFilter } = useErpAnalytics();
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];
  const empresas = data?.empresas || [];

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 uppercase">Ano</span>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-purple-500"
        >
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      {empresas.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 uppercase">Empresa</span>
          <select
            value={empresaFilter ?? ""}
            onChange={(e) => setEmpresaFilter(e.target.value ? Number(e.target.value) : null)}
            className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-purple-500 max-w-48"
          >
            <option value="">Todas</option>
            {empresas.map(e => (
              <option key={e.cd_empresa} value={e.cd_empresa}>
                {getEmpresaLabel(e.cd_empresa)}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}