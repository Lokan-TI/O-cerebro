// Matriz de confusão por família: lifecycle v1 (NF) × motor legado (remessa), por cliente.
const LABELS = { ativo: "Ativos", risco: "Em risco", churn: "Dormentes / Churn", pre_venda: "Pré-venda" };

const fmt = (v) => (Number(v) || 0).toLocaleString("pt-BR");

export default function LifecycleClientMatrix({ families, matrix }) {
  const fams = families || [];
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 overflow-x-auto">
      <h4 className="text-sm font-semibold text-white mb-1">Matriz por cliente (v1 × legado)</h4>
      <p className="text-xs text-gray-500 mb-3">
        Linhas = família no lifecycle v1 · colunas = família no motor legado. A diagonal é concordância.
      </p>
      <table className="w-full text-sm min-w-[520px]">
        <thead>
          <tr className="text-gray-500 text-xs border-b border-gray-800">
            <th className="text-left py-1.5">v1 ↓ / legado →</th>
            {fams.map((f) => <th key={f} className="text-right py-1.5 px-2">{LABELS[f] || f}</th>)}
          </tr>
        </thead>
        <tbody>
          {fams.map((a) => (
            <tr key={a} className="border-b border-gray-800/60 text-gray-300">
              <td className="py-1.5">{LABELS[a] || a}</td>
              {fams.map((b) => (
                <td
                  key={b}
                  className={`py-1.5 px-2 text-right ${a === b ? "text-emerald-400 font-medium" : (matrix?.[a]?.[b] ? "text-amber-400" : "text-gray-600")}`}
                >
                  {fmt(matrix?.[a]?.[b])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}