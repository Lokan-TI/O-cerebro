// Reconciliação por família: lifecycle v1 (NF) × motor legado (remessa).
const FAMILIES = [
  { id: "ativo", label: "Ativos" },
  { id: "risco", label: "Em risco" },
  { id: "churn", label: "Dormentes / Churn" },
];

const V1_FAM = { REPEAT: "ativo", ACTIVE: "ativo", REACTIVATED: "ativo", AT_RISK: "risco", DORMANT: "churn", CHURNED: "churn" };
const LEGACY_FAM = {
  "Novo ativo": "ativo", "Recorrente": "ativo", "Reativado": "ativo",
  "Em risco": "risco", "Em churn": "churn", "Dormente": "churn", "Churn confirmado": "churn",
};

export default function LifecycleFamilyCompare({ v1Distribution, legacyDistribution }) {
  const sum = (dist, famMap, fam) =>
    (dist || []).reduce((s, r) => s + (famMap[r.status] === fam ? Number(r.count) || 0 : 0), 0);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <h4 className="text-sm font-semibold text-white mb-1">Paralelo v1 × legado (por família)</h4>
      <p className="text-xs text-gray-500 mb-3">
        v1 conta por NF emitida; o legado, por remessa realizada — universos distintos, divergência estrutural esperada (doc 10).
        Prospector / Novo cadastro ficam fora do universo v1.
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-500 text-xs border-b border-gray-800">
            <th className="text-left py-1.5">Família</th>
            <th className="text-right py-1.5">Lifecycle v1 (NF)</th>
            <th className="text-right py-1.5">Legado (remessa)</th>
            <th className="text-right py-1.5">Diferença</th>
          </tr>
        </thead>
        <tbody>
          {FAMILIES.map((f) => {
            const a = sum(v1Distribution, V1_FAM, f.id);
            const b = sum(legacyDistribution, LEGACY_FAM, f.id);
            return (
              <tr key={f.id} className="border-b border-gray-800/60 text-gray-300">
                <td className="py-1.5">{f.label}</td>
                <td className="py-1.5 text-right font-medium text-white">{a.toLocaleString("pt-BR")}</td>
                <td className="py-1.5 text-right">{b.toLocaleString("pt-BR")}</td>
                <td className={`py-1.5 text-right ${a - b === 0 ? "text-emerald-400" : "text-amber-400"}`}>
                  {(a - b).toLocaleString("pt-BR", { signDisplay: "always" })}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}