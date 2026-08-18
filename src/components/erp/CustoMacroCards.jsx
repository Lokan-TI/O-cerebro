import { MACRO_LABEL } from "@/components/erp/custoCentros";
import { fmtCur, fmtNum } from "@/lib/erpFormat";

const ORDER = ["operacional", "administrativo", "comercial", "financeiro", "impostos", "investimento", "outros", "nao_classificado"];
const COLOR = {
  operacional: "border-blue-800/40 bg-blue-950/30 text-blue-300",
  administrativo: "border-purple-800/40 bg-purple-950/30 text-purple-300",
  comercial: "border-emerald-800/40 bg-emerald-950/30 text-emerald-300",
  financeiro: "border-amber-800/40 bg-amber-950/30 text-amber-300",
  impostos: "border-red-800/40 bg-red-950/30 text-red-300",
  investimento: "border-cyan-800/40 bg-cyan-950/30 text-cyan-300",
  outros: "border-gray-800 bg-gray-900 text-gray-300",
  nao_classificado: "border-gray-800 bg-gray-900 text-gray-400",
};

// Leitura executiva: quanto pesa cada macro-categoria de despesa.
export default function CustoMacroCards({ macro, total }) {
  const items = ORDER.filter((k) => macro[k] && macro[k].vl_total > 0);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      {items.map((k) => {
        const m = macro[k];
        const share = total > 0 ? (m.vl_total / total) * 100 : 0;
        return (
          <div key={k} className={`rounded-xl border p-4 ${COLOR[k]}`}>
            <div className="text-xs uppercase tracking-wide mb-1 leading-tight">{MACRO_LABEL[k]}</div>
            <div className="text-xl font-bold text-white">{fmtCur(m.vl_total)}</div>
            <div className="text-xs text-gray-500 mt-1">
              {share.toFixed(1)}% da despesa · pago {fmtCur(m.vl_pago)} · {fmtNum(m.qtd)} títulos
            </div>
            <div className="h-1.5 bg-gray-800 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-current opacity-70" style={{ width: `${Math.min(share, 100)}%` }} />
            </div>
          </div>
        );
      })}
      {items.length === 0 && <div className="text-gray-600 text-sm">Sem despesas no período.</div>}
    </div>
  );
}