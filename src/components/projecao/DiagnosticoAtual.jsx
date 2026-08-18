import { AlertOctagon, AlertTriangle, CheckCircle2, Stethoscope } from "lucide-react";

const STYLE = {
  red: { box: "border-red-700/60 bg-red-950/30", text: "text-red-300", chip: "bg-red-900/60 text-red-200", Icon: AlertOctagon, label: "Crítico" },
  amber: { box: "border-amber-700/60 bg-amber-950/25", text: "text-amber-300", chip: "bg-amber-900/60 text-amber-200", Icon: AlertTriangle, label: "Atenção" },
  green: { box: "border-emerald-700/60 bg-emerald-950/25", text: "text-emerald-300", chip: "bg-emerald-900/60 text-emerald-200", Icon: CheckCircle2, label: "Sustentável" },
};

const ORDER = ["red", "amber", "green"];

export default function DiagnosticoAtual({ findings, score }) {
  if (!findings?.length) return null;
  const sorted = [...findings].sort((a, b) => ORDER.indexOf(a.severity) - ORDER.indexOf(b.severity));

  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-purple-400" /> Momento atual da empresa
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Leitura dos indicadores reais do ERP contra as referências de mercado de locação.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {ORDER.map((s) => (
            <span key={s} className={`px-2.5 py-1 rounded-full ${STYLE[s].chip}`}>
              {score?.[s] || 0} {STYLE[s].label}
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {sorted.map((fnd, i) => {
          const st = STYLE[fnd.severity];
          const Icon = st.Icon;
          return (
            <div key={i} className={`border rounded-lg p-4 ${st.box}`}>
              <div className="flex items-start gap-2">
                <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${st.text}`} />
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wide text-gray-500">{fnd.area}</p>
                  <p className={`text-sm font-semibold ${st.text}`}>{fnd.title}</p>
                  <p className="text-sm text-gray-300 mt-1">{fnd.evidence}</p>
                  <p className="text-sm text-gray-400 mt-2">
                    <span className="text-gray-500">Ação: </span>{fnd.action}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}