const LABELS = {
  dicionario: "Dicionário disponível",
  documentacao: "Colunas documentadas",
  tabelas_criticas: "Tabelas críticas presentes",
  relacionamentos: "Relacionamentos declarados",
};

export default function OnboardingScoreCard({ score, breakdown }) {
  const tone = score >= 80 ? "text-emerald-400" : score >= 50 ? "text-amber-400" : "text-red-400";
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Trust Score da fonte</p>
      <p className={`text-4xl font-semibold ${tone}`}>{score}<span className="text-lg text-gray-500">/100</span></p>
      <div className="mt-4 space-y-2">
        {Object.entries(breakdown || {}).map(([key, b]) => (
          <div key={key}>
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>{LABELS[key] || key} <span className="text-gray-600">· peso {b.peso}%</span></span>
              <span className="text-gray-300">{b.nota}%</span>
            </div>
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-purple-500 rounded-full" style={{ width: `${Math.min(100, b.nota)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}