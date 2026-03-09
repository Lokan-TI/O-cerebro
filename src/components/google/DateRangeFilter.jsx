// Filtro de intervalo de meses disponíveis no cohort (Jan/25–Nov/25)
const MESES = [
  { value: "2025-01", label: "Jan/25" },
  { value: "2025-02", label: "Fev/25" },
  { value: "2025-03", label: "Mar/25" },
  { value: "2025-04", label: "Abr/25" },
  { value: "2025-05", label: "Mai/25" },
  { value: "2025-06", label: "Jun/25" },
  { value: "2025-07", label: "Jul/25" },
  { value: "2025-08", label: "Ago/25" },
  { value: "2025-09", label: "Set/25" },
  { value: "2025-10", label: "Out/25" },
  { value: "2025-11", label: "Nov/25" },
];

export const DATE_RANGE_DEFAULT = { from: "2025-01", to: "2025-11" };

export function isInRange(dateStr, dateRange) {
  // dateStr pode ser "YYYY-MM-DD" ou "YYYY-MM"
  const ym = dateStr.substring(0, 7);
  return ym >= dateRange.from && ym <= dateRange.to;
}

export default function DateRangeFilter({ dateRange, onChange }) {
  const fromIdx = MESES.findIndex(m => m.value === dateRange.from);
  const toIdx   = MESES.findIndex(m => m.value === dateRange.to);

  const isAllSelected = dateRange.from === DATE_RANGE_DEFAULT.from && dateRange.to === DATE_RANGE_DEFAULT.to;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-gray-500 text-xs uppercase tracking-wider whitespace-nowrap">Período:</span>

      <select
        value={dateRange.from}
        onChange={e => {
          const newFrom = e.target.value;
          onChange({ from: newFrom, to: dateRange.to < newFrom ? newFrom : dateRange.to });
        }}
        className="bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded-md px-2 py-1.5 focus:outline-none focus:border-blue-500 cursor-pointer"
      >
        {MESES.map(m => (
          <option key={m.value} value={m.value}>{m.label}</option>
        ))}
      </select>

      <span className="text-gray-600 text-xs">→</span>

      <select
        value={dateRange.to}
        onChange={e => {
          const newTo = e.target.value;
          onChange({ from: dateRange.from > newTo ? newTo : dateRange.from, to: newTo });
        }}
        className="bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded-md px-2 py-1.5 focus:outline-none focus:border-blue-500 cursor-pointer"
      >
        {MESES.map(m => (
          <option key={m.value} value={m.value}>{m.label}</option>
        ))}
      </select>

      {!isAllSelected && (
        <button
          onClick={() => onChange(DATE_RANGE_DEFAULT)}
          className="text-xs text-gray-500 hover:text-white bg-gray-800 border border-gray-700 px-2 py-1.5 rounded-md transition-colors whitespace-nowrap"
        >
          ✕ Limpar
        </button>
      )}
    </div>
  );
}