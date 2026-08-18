import { fmtCur, fmtNum } from "@/lib/erpFormat";
import { Info, Repeat, UserMinus, TrendingDown, Users } from "lucide-react";

const pct = (v) => (v == null ? "—" : `${v.toFixed(1)}%`);

// Churn em janela móvel de 12 meses, ponderado por receita — leitura correta para
// locação, onde o ciclo de recompra é longo e a receita vem da base recorrente.
export default function ChurnMetricPanel({ churn12, calendarChurn }) {
  if (!churn12) {
    return (
      <div className="bg-amber-950/30 border border-amber-800/40 rounded-lg px-4 py-3 text-xs text-amber-300">
        A métrica de churn foi revisada (janela móvel de 12 meses e ponderação por receita).
        Clique em "Atualizar dados" para recalcular.
      </div>
    );
  }

  const cards = [
    { icon: Users, label: "Base ativa (12 meses)", value: fmtNum(churn12.active_clients), sub: `${fmtNum(churn12.retained_clients)} recorrentes · ${fmtNum(churn12.new_clients)} novos`, color: "purple" },
    { icon: Repeat, label: "Retenção (12 meses)", value: pct(churn12.retention_rate), sub: `De ${fmtNum(churn12.base_clients)} clientes dos 12 meses anteriores`, color: "green" },
    { icon: UserMinus, label: "Churn de clientes", value: pct(churn12.churn_rate), sub: `${fmtNum(churn12.churned_clients)} sem faturar nos últimos 12 meses`, color: "red" },
    { icon: TrendingDown, label: "Churn de receita", value: pct(churn12.revenue_churn_rate), sub: `${fmtCur(churn12.revenue_at_risk)} da receita da base perdida`, color: "amber" },
  ];
  const colors = {
    green: "border-green-700/40 bg-green-950/30",
    red: "border-red-700/40 bg-red-950/30",
    purple: "border-purple-700/40 bg-purple-950/30",
    amber: "border-amber-700/40 bg-amber-950/30",
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className={`rounded-xl border p-4 ${colors[c.color]}`}>
            <div className="flex items-center gap-2 mb-2">
              <c.icon className="w-4 h-4 opacity-70 text-gray-300" />
              <span className="text-xs text-gray-400 uppercase tracking-wide">{c.label}</span>
            </div>
            <div className="text-2xl font-bold text-white">{c.value}</div>
            <div className="text-xs text-gray-500 mt-1">{c.sub}</div>
          </div>
        ))}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <div className="text-xs text-gray-500 mb-1">Receita de clientes da base</div>
          <div className="text-lg font-bold text-green-400">{pct(churn12.retained_revenue_share)}</div>
          <div className="text-xs text-gray-600">{fmtCur(churn12.retained_revenue)} nos últimos 12 meses</div>
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1">Receita de clientes novos</div>
          <div className="text-lg font-bold text-blue-400">{pct(churn12.new_revenue_share)}</div>
          <div className="text-xs text-gray-600">{fmtCur(churn12.new_revenue)} nos últimos 12 meses</div>
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1">Receita total da janela</div>
          <div className="text-lg font-bold text-white">{fmtCur(churn12.current_revenue)}</div>
          <div className="text-xs text-gray-600">Base dos 12 meses anteriores: {fmtCur(churn12.base_revenue)}</div>
        </div>
      </div>

      <div className="bg-blue-950/20 border border-blue-900/40 rounded-lg px-4 py-3 flex items-start gap-2">
        <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-200/80 space-y-1">
          <div>
            <span className="text-blue-200 font-medium">Como é calculado:</span> base = clientes com nota fiscal
            entre 24 e 12 meses atrás; churn = os que não emitiram nenhuma nota nos últimos 12 meses.
            O churn de receita pondera cada cliente pelo faturamento que ele trazia.
          </div>
          <div>
            <span className="text-blue-200 font-medium">Falhas corrigidas:</span> a métrica anterior comparava
            o ano civil corrente (jan → hoje) com o ano anterior — quem alugou no 2º semestre passado era
            marcado como churn no meio do ano; e contava por cabeça, então a cauda de clientes pontuais
            dominava o percentual e escondia que a receita vem da base recorrente.
            {calendarChurn != null && <> Churn pelo critério antigo (ano civil): {pct(calendarChurn)}.</>}
          </div>
        </div>
      </div>
    </div>
  );
}