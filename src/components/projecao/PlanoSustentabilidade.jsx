import { ListChecks } from "lucide-react";

export default function PlanoSustentabilidade({ steps }) {
  if (!steps?.length) return null;

  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
      <h2 className="text-lg font-semibold text-white flex items-center gap-2">
        <ListChecks className="w-5 h-5 text-purple-400" /> Passos e decisões para o crescimento continuar sustentável
      </h2>
      <p className="text-sm text-gray-400 mt-1 mb-4">
        Sequência de decisões derivada do diagnóstico acima e do investimento exigido pelo plano.
      </p>

      <div className="space-y-4">
        {steps.map((step, i) => (
          <div key={i} className="border border-gray-800 rounded-lg p-4 bg-gray-950/40">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-6 h-6 rounded-full bg-purple-900/60 text-purple-200 text-xs flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <p className="text-sm font-semibold text-white">{step.horizonte}</p>
            </div>
            <ul className="space-y-1.5 pl-8">
              {step.decisoes.map((d, j) => (
                <li key={j} className="text-sm text-gray-300 list-disc">{d}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}