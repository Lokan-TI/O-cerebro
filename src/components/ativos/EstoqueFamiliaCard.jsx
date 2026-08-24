import { fmtNum } from "@/lib/erpFormat";

export default function EstoqueFamiliaCard({ dados, accent, bar, subtitle }) {
  const maior = Math.max(...dados.grupos.map((g) => g.saldo), 1);

  return (
    <div className={`rounded-xl border p-4 ${accent}`}>
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">{dados.familia}</div>
          <div className="text-xs text-gray-400">{subtitle}</div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-white">{fmtNum(Math.round(dados.saldo))}</div>
          <div className="text-xs text-gray-400">peças em estoque</div>
        </div>
      </div>

      <div className="text-xs text-gray-400 mt-3">
        {fmtNum(dados.itens_com_saldo)} itens com saldo · {fmtNum(dados.itens_zerados)} zerados ·{" "}
        {fmtNum(dados.itens)} cadastrados
      </div>

      <div className="mt-4 space-y-2">
        {dados.grupos.map((g) => (
          <div key={g.cd_grupo}>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-300 truncate">{g.nm_grupo}</span>
              <span className="text-white font-medium ml-2">{fmtNum(Math.round(g.saldo))}</span>
            </div>
            <div className="h-1.5 bg-gray-800 rounded mt-1 overflow-hidden">
              <div className={`h-full ${bar}`} style={{ width: `${Math.max((g.saldo / maior) * 100, 1)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}