// Maiores divergências por cliente entre lifecycle v1 e motor legado, ordenadas por receita 12m.
const fmtBRL = (v) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export default function LifecycleDivergenceTable({ rows }) {
  if (!rows?.length) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-sm text-gray-400">
        Nenhuma divergência de família entre os dois motores neste corte.
      </div>
    );
  }
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 overflow-x-auto">
      <h4 className="text-sm font-semibold text-white mb-1">Maiores divergências por cliente</h4>
      <p className="text-xs text-gray-500 mb-3">
        Top {rows.length} por receita 12m — base para a aprovação das divergências com o negócio (doc 10, passo 3).
      </p>
      <table className="w-full text-sm min-w-[640px]">
        <thead>
          <tr className="text-gray-500 text-xs border-b border-gray-800">
            <th className="text-left py-1.5">Cliente</th>
            <th className="text-left py-1.5">Lifecycle v1</th>
            <th className="text-left py-1.5">Legado</th>
            <th className="text-left py-1.5">Última NF</th>
            <th className="text-right py-1.5">Receita 12m</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.cd_pessoa} className="border-b border-gray-800/60 text-gray-300">
              <td className="py-1.5">
                {r.nm_pessoa || `Cliente ${r.cd_pessoa}`}
                <span className="text-gray-600 text-xs ml-1">#{r.cd_pessoa}</span>
              </td>
              <td className="py-1.5 text-purple-300">{r.v1_status}</td>
              <td className="py-1.5 text-cyan-300">{r.legacy_status}</td>
              <td className="py-1.5 text-gray-500">{r.last_nf || "—"}</td>
              <td className="py-1.5 text-right text-white font-medium">{fmtBRL(r.revenue_12m)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}