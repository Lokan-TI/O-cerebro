import { fmtCur } from "@/lib/erpFormat";
import { FileText } from "lucide-react";

const Line = ({ label, valor, hint, tone = "neutro", strong, indent }) => {
  const color = tone === "pos" ? "text-emerald-300" : tone === "neg" ? "text-red-300" : "text-white";
  return (
    <div className={`flex items-start justify-between gap-4 py-2 border-b border-gray-800/70 ${indent ? "pl-5" : ""}`}>
      <div>
        <div className={`text-sm ${strong ? "font-semibold text-white" : "text-gray-300"}`}>{label}</div>
        {hint && <div className="text-xs text-gray-500 mt-0.5">{hint}</div>}
      </div>
      <div className={`text-sm tabular-nums whitespace-nowrap ${strong ? "font-bold" : ""} ${color}`}>
        {fmtCur(valor)}
      </div>
    </div>
  );
};

export default function DreCaixa({ summary, regime }) {
  const margem = summary.receita ? (summary.resultadoOperacional / summary.receita) * 100 : 0;
  return (
    <section className="border border-gray-800 bg-gray-900/50 rounded-xl p-5">
      <h2 className="text-lg font-bold text-white flex items-center gap-2">
        <FileText className="w-5 h-5 text-emerald-400" /> DRE gerencial — regime de {regime === "baixa" ? "caixa" : regime}
      </h2>
      <p className="text-sm text-gray-400 mt-1 mb-4">
        Entradas do contas a receber menos saídas do contas a pagar, classificadas pela natureza financeira do plano.
        Transferências entre contas ficam fora do resultado.
      </p>

      <Line label="Receita operacional" valor={summary.receita} hint="Contas do grupo Entradas (locação, serviços, vendas)" tone="pos" strong />
      {summary.outrasEntradas > 0 && (
        <Line label="Outras entradas" valor={summary.outrasEntradas} hint="Entradas fora do grupo de receitas" tone="pos" indent />
      )}
      <Line label="(−) Custos e despesas (OPEX)" valor={-summary.opex} hint="Despesas operacionais, pessoal, financeiras e administrativas" tone="neg" />
      {summary.saidaEmContaDeEntrada > 0 && (
        <Line
          label="(−) Saídas lançadas em contas de receita" valor={-summary.saidaEmContaDeEntrada}
          hint="Títulos a pagar classificados em conta do grupo Entradas — revisar no ERP" tone="neg" indent
        />
      )}
      {summary.semClassificacao > 0 && (
        <Line label="(−) Saídas sem classificação" valor={-summary.semClassificacao} tone="neg" indent />
      )}
      <Line label="= Resultado operacional de caixa" valor={summary.resultadoOperacional} strong
        tone={summary.resultadoOperacional >= 0 ? "pos" : "neg"}
        hint={`Margem sobre a receita: ${margem.toFixed(1)}%`} />
      <Line label="(−) Investimentos (CAPEX)" valor={-summary.capex} hint="Aquisições e investimentos — grupo 22 do plano" tone="neg" />
      <Line label="= Resultado após investimentos" valor={summary.resultadoAposInvestimento} strong
        tone={summary.resultadoAposInvestimento >= 0 ? "pos" : "neg"} />
      <Line label="Movimentação entre contas (informativo)" valor={summary.movimentacao}
        hint="Transferências e outras movimentações — não são custo nem receita" />
    </section>
  );
}