import { Calendar } from "lucide-react";

const PRESETS = [
  {
    id: "yoy",
    label: "Ano anterior vs Atual",
    getDates: () => {
      const year = new Date().getFullYear();
      return {
        ref_start: `${year - 1}-01-01`,
        ref_end: `${year}-01-01`,
        analysis_start: `${year}-01-01`,
        analysis_end: new Date().toISOString().slice(0, 10),
      };
    },
  },
  {
    id: "last12_vs_last6",
    label: "12 meses vs 6 meses recentes",
    getDates: () => {
      const now = new Date();
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
      const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 12, 1);
      return {
        ref_start: twelveMonthsAgo.toISOString().slice(0, 10),
        ref_end: sixMonthsAgo.toISOString().slice(0, 10),
        analysis_start: sixMonthsAgo.toISOString().slice(0, 10),
        analysis_end: now.toISOString().slice(0, 10),
      };
    },
  },
  {
    id: "h1_vs_h2",
    label: "1º semestre vs 2º semestre",
    getDates: () => {
      const year = new Date().getFullYear();
      return {
        ref_start: `${year}-01-01`,
        ref_end: `${year}-07-01`,
        analysis_start: `${year}-07-01`,
        analysis_end: new Date().toISOString().slice(0, 10),
      };
    },
  },
];

export default function ChurnDateRangeFilter({ dates, onChange, onApply, loading }) {
  const activePreset = PRESETS.find(p => {
    const d = p.getDates();
    return d.ref_start === dates.ref_start && d.ref_end === dates.ref_end &&
      d.analysis_start === dates.analysis_start && d.analysis_end === dates.analysis_end;
  });

  const inputClass = "bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500";

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-purple-400" />
        <h3 className="text-white font-semibold text-sm">Período de Análise de Churn</h3>
      </div>

      <div className="flex gap-2 flex-wrap">
        {PRESETS.map(p => (
          <button
            key={p.id}
            onClick={() => onChange(p.getDates())}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activePreset?.id === p.id
                ? "bg-purple-600 text-white"
                : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-2 font-medium">
            Período de Referência — quando compravam
          </p>
          <div className="flex gap-2 items-center">
            <input
              type="date"
              value={dates.ref_start}
              onChange={e => onChange({ ...dates, ref_start: e.target.value })}
              className={inputClass}
            />
            <span className="text-gray-600">→</span>
            <input
              type="date"
              value={dates.ref_end}
              onChange={e => onChange({ ...dates, ref_end: e.target.value })}
              className={inputClass}
            />
          </div>
        </div>
        <div>
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-2 font-medium">
            Período de Análise — pararam de comprar?
          </p>
          <div className="flex gap-2 items-center">
            <input
              type="date"
              value={dates.analysis_start}
              onChange={e => onChange({ ...dates, analysis_start: e.target.value })}
              className={inputClass}
            />
            <span className="text-gray-600">→</span>
            <input
              type="date"
              value={dates.analysis_end}
              onChange={e => onChange({ ...dates, analysis_end: e.target.value })}
              className={inputClass}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={onApply}
          disabled={loading}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
        >
          {loading ? "Analisando..." : "Analisar Churn"}
        </button>
      </div>
    </div>
  );
}