import { Fragment, useState } from "react";
import { MACRO_LABEL } from "@/components/erp/custoCentros";
import { fmtCur, fmtNum } from "@/lib/erpFormat";
import { ChevronRight, ChevronDown } from "lucide-react";

// Grupo → blocos (centros de custo) → contas analíticas, com participação no total.
export default function CustoGrupoTree({ grupo, total }) {
  const [openBlocos, setOpenBlocos] = useState({});
  const share = total > 0 ? (grupo.subtotal.vl_total / total) * 100 : 0;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-gray-800 bg-gray-800/30 flex-wrap">
        <div>
          <div className="text-white font-semibold text-sm">{grupo.label}</div>
          <div className="text-xs text-gray-500">{share.toFixed(1)}% da despesa total · {fmtNum(grupo.subtotal.qtd)} títulos</div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-white">{fmtCur(grupo.subtotal.vl_total)}</div>
          <div className="text-xs text-gray-500">Pago {fmtCur(grupo.subtotal.vl_pago)} · Aberto {fmtCur(grupo.subtotal.vl_aberto)}</div>
        </div>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-500 text-xs uppercase border-b border-gray-800">
            <th className="text-left py-2 px-4">Centro de custo (bloco)</th>
            <th className="text-right py-2 px-3">Títulos</th>
            <th className="text-right py-2 px-3">Total</th>
            <th className="text-right py-2 px-3">Pago</th>
            <th className="text-right py-2 px-3">Aberto</th>
            <th className="text-right py-2 px-3">Vencido</th>
            <th className="text-right py-2 px-4">% do grupo</th>
          </tr>
        </thead>
        <tbody>
          {grupo.blocos.map((b) => {
            const open = !!openBlocos[b.key];
            const pct = grupo.subtotal.vl_total > 0 ? (b.subtotal.vl_total / grupo.subtotal.vl_total) * 100 : 0;
            return (
              <Fragment key={b.key}>
                <tr onClick={() => setOpenBlocos((s) => ({ ...s, [b.key]: !open }))} className="border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer">
                  <td className="py-2 px-4">
                    <div className="flex items-center gap-2">
                      {open ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                      <span className="text-white font-medium">{b.label}</span>
                      <span className="text-xs text-gray-600 font-mono">{b.key}</span>
                      <span className="text-xs text-gray-500">· {MACRO_LABEL[b.macro]}</span>
                    </div>
                  </td>
                  <td className="py-2 px-3 text-right text-gray-400">{fmtNum(b.subtotal.qtd)}</td>
                  <td className="py-2 px-3 text-right text-white font-medium">{fmtCur(b.subtotal.vl_total)}</td>
                  <td className="py-2 px-3 text-right text-green-400">{fmtCur(b.subtotal.vl_pago)}</td>
                  <td className="py-2 px-3 text-right text-amber-400">{fmtCur(b.subtotal.vl_aberto)}</td>
                  <td className="py-2 px-3 text-right text-red-400">{fmtCur(b.subtotal.vl_vencido)}</td>
                  <td className="py-2 px-4 text-right text-gray-400">{pct.toFixed(1)}%</td>
                </tr>
                {open && b.contas.map((c, i) => (
                  <tr key={`${b.key}-${i}`} className="border-b border-gray-800/30 bg-gray-950/40">
                    <td className="py-1.5 px-4 pl-12 text-gray-300">
                      {c.ds_planfin} <span className="text-xs text-gray-600 font-mono">{c.nr_planfin}</span>
                    </td>
                    <td className="py-1.5 px-3 text-right text-gray-500">{fmtNum(c.qtd)}</td>
                    <td className="py-1.5 px-3 text-right text-gray-200">{fmtCur(c.vl_total)}</td>
                    <td className="py-1.5 px-3 text-right text-green-400/80">{fmtCur(c.vl_pago)}</td>
                    <td className="py-1.5 px-3 text-right text-amber-400/80">{fmtCur(c.vl_aberto)}</td>
                    <td className="py-1.5 px-3 text-right text-red-400/80">{fmtCur(c.vl_vencido)}</td>
                    <td className="py-1.5 px-4 text-right text-gray-600 text-xs">
                      {b.subtotal.vl_total > 0 ? `${((c.vl_total / b.subtotal.vl_total) * 100).toFixed(1)}%` : "—"}
                    </td>
                  </tr>
                ))}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}