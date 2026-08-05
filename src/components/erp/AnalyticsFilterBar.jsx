import { useErpAnalytics } from "@/lib/ErpAnalyticsContext";
import { getEmpresaLabel } from "@/lib/empresaLabels";

export default function AnalyticsFilterBar() {
  const { year, setYear } = useErpAnalytics();
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];

  return (
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
  );
}