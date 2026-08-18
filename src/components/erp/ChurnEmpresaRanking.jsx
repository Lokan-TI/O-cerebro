import { useMemo } from "react";
import { getEmpresaLabel, compareEmpresa } from "@/lib/empresaLabels";
import { fmtCur, fmtNum } from "@/lib/erpFormat";
import { Award, AlertTriangle, Building2 } from "lucide-react";

const pct = (v) => (v == null ? "—" : `${v.toFixed(1)}%`);

// Ranking de filiais pela janela móvel de 12 meses: quem retém mais clientes,
// quem perde mais receita e quem cresce com clientes novos.
export default function ChurnEmpresaRanking({ rows, selectedEmpresa, onSelectEmpresa }) {
  // Mostra toda filial com atividade. As filiais novas (sem base nos 12 meses
  // anteriores) não têm retenção/churn calculável — aparecem no fim da lista com "—".
  const list = useMemo(() => {
    const arr = (rows || []).filter(
      (r) => r.base_clients > 0 || r.new_clients > 0 || r.current_revenue > 0
    );
    return [...arr].sort((a, b) => compareEmpresa(a.cd_empresa, b.cd_empresa));
  }, [rows]);

  // Destaques só entre filiais com base comparável.
  const comparaveis = useMemo(() => list.filter((r) => r.base_clients > 0), [list]);

  if (!rows || rows.length === 0) {
    return (
      <div className="bg-amber-950/30 border border-amber-800/40 rounded-xl px-4 py-3 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
        <span className="text-amber-300 text-xs">
          Churn por empresa ainda não calculado neste snapshot. Clique em "Atualizar dados" para gerar a métrica por filial.
        </span>
      </div>
    );
  }

  const best = comparaveis[0];
  const worst = comparaveis[comparaveis.length - 1];
  const maiorRisco = [...comparaveis].sort((a, b) => b.revenue_at_risk - a.revenue_at_risk)[0];

  return (
    <div className="space-y-3">
      {best && (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl border border-green-700/40 bg-green-950/30 p-4">
          <div className="flex items-center gap-2 mb-1"><Award className="w-4 h-4 text-green-400" /><span className="text-xs text-gray-400 uppercase">Melhor retenção</span></div>
          <div className="text-white font-semibold text-sm truncate">{getEmpresaLabel(best.cd_empresa)}</div>
          <div className="text-xl font-bold text-green-400">{pct(best.retention_rate)}</div>
          <div className="text-xs text-gray-500">{fmtNum(best.retained_clients)} de {fmtNum(best.base_clients)} clientes mantidos</div>
        </div>
        <div className="rounded-xl border border-red-700/40 bg-red-950/30 p-4">
          <div className="flex items-center gap-2 mb-1"><AlertTriangle className="w-4 h-4 text-red-400" /><span className="text-xs text-gray-400 uppercase">Maior churn</span></div>
          <div className="text-white font-semibold text-sm truncate">{getEmpresaLabel(worst.cd_empresa)}</div>
          <div className="text-xl font-bold text-red-400">{pct(worst.churn_rate)}</div>
          <div className="text-xs text-gray-500">{fmtNum(worst.churned_clients)} clientes sem NF nos últimos 12 meses</div>
        </div>
        <div className="rounded-xl border border-amber-700/40 bg-amber-950/30 p-4">
          <div className="flex items-center gap-2 mb-1"><Building2 className="w-4 h-4 text-amber-400" /><span className="text-xs text-gray-400 uppercase">Maior receita em risco</span></div>
          <div className="text-white font-semibold text-sm truncate">{getEmpresaLabel(maiorRisco.cd_empresa)}</div>
          <div className="text-xl font-bold text-amber-400">{fmtCur(maiorRisco.revenue_at_risk)}</div>
          <div className="text-xs text-gray-500">{pct(maiorRisco.revenue_churn_rate)} da receita da base anterior</div>
        </div>
      </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 text-xs uppercase border-b border-gray-800">
              <th className="text-left py-2 px-3">#</th>
              <th className="text-left py-2 px-3">Empresa</th>
              <th className="text-right py-2 px-3">Base 12m ant.</th>
              <th className="text-right py-2 px-3">Retidos</th>
              <th className="text-right py-2 px-3">Novos</th>
              <th className="text-right py-2 px-3">Perdidos</th>
              <th className="text-right py-2 px-3">Retenção</th>
              <th className="text-right py-2 px-3">Churn</th>
              <th className="text-right py-2 px-3">Churn de receita</th>
              <th className="text-right py-2 px-3">Receita 12m</th>
              <th className="text-right py-2 px-3">Receita em risco</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r, i) => (
              <tr
                key={r.cd_empresa}
                onClick={() => onSelectEmpresa?.(r.cd_empresa)}
                className={`border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer ${r.cd_empresa === selectedEmpresa ? "bg-purple-950/40" : ""}`}
              >
                <td className="py-2 px-3 text-gray-500">{i + 1}</td>
                <td className="py-2 px-3 text-white">
                  {getEmpresaLabel(r.cd_empresa)}
                  {!(r.base_clients > 0) && (
                    <span className="ml-2 text-[10px] uppercase text-blue-300 border border-blue-800/60 bg-blue-950/40 rounded px-1.5 py-0.5">
                      filial nova
                    </span>
                  )}
                </td>
                <td className="py-2 px-3 text-right text-gray-300">{fmtNum(r.base_clients)}</td>
                <td className="py-2 px-3 text-right text-green-400">{fmtNum(r.retained_clients)}</td>
                <td className="py-2 px-3 text-right text-blue-400">{fmtNum(r.new_clients)}</td>
                <td className="py-2 px-3 text-right text-red-400">{fmtNum(r.churned_clients)}</td>
                <td className="py-2 px-3 text-right text-green-400 font-medium">{pct(r.retention_rate)}</td>
                <td className="py-2 px-3 text-right text-red-400 font-medium">{pct(r.churn_rate)}</td>
                <td className="py-2 px-3 text-right text-amber-400">{pct(r.revenue_churn_rate)}</td>
                <td className="py-2 px-3 text-right text-white">{fmtCur(r.current_revenue)}</td>
                <td className="py-2 px-3 text-right text-amber-400">{fmtCur(r.revenue_at_risk)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-600">
        Base = clientes com NF entre 24 e 12 meses atrás na filial · churn = os que não emitiram NF nos últimos 12 meses ·
        receita em risco = faturamento que esses clientes geravam. O consolidado do grupo remove a duplicidade de clientes
        atendidos por mais de uma filial, por isso a soma das linhas é maior que o geral.
        Filiais marcadas como "filial nova" não tinham clientes na janela de 12 meses anteriores — retenção e churn
        ficam sem base de comparação ("—"), mas os clientes novos e a receita do período são reais.
      </p>
    </div>
  );
}