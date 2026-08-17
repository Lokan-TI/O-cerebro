import { fmtCur, fmtNum } from "@/lib/erpFormat";

// Bloco de um grupo do plano financeiro (Saídas / Entradas / Sem conta) com
// as contas do CAP, participação sobre o total e abertura por status.
export default function CapContaGroup({ group, grandTotal }) {
  const sub = group.subtotal;
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h3 className="text-white font-semibold text-sm">{group.label}</h3>
        <span className="text-xs text-gray-500">
          {fmtNum(sub.qtd)} títulos · <span className="text-red-400 font-medium">{fmtCur(sub.vl_total)}</span>
          {grandTotal > 0 && ` · ${((sub.vl_total / grandTotal) * 100).toFixed(1)}% do CAP`}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 text-xs uppercase border-b border-gray-800">
              <th className="text-left py-2 px-3">Conta</th>
              <th className="text-left py-2 px-3">Descrição</th>
              <th className="text-right py-2 px-3">Qtd</th>
              <th className="text-right py-2 px-3">Total</th>
              <th className="text-right py-2 px-3">Em aberto</th>
              <th className="text-right py-2 px-3">Vencido</th>
              <th className="text-right py-2 px-3">Provisório</th>
              <th className="text-right py-2 px-3">Baixado</th>
              <th className="text-left py-2 px-3 w-32">Participação</th>
            </tr>
          </thead>
          <tbody>
            {group.rows.map((r, i) => {
              const pct = grandTotal > 0 ? (Number(r.vl_total) / grandTotal) * 100 : 0;
              return (
                <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="py-2 px-3 text-gray-400 font-mono text-xs">{r.nr_planfin || "—"}</td>
                  <td className="py-2 px-3 text-white">
                    {r.ds_planfin}
                    {r.fl_planfin === "I" && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-500 border border-gray-700">inativa</span>}
                  </td>
                  <td className="py-2 px-3 text-right text-gray-300">{fmtNum(r.qtd)}</td>
                  <td className="py-2 px-3 text-right text-red-400 font-medium">{fmtCur(r.vl_total)}</td>
                  <td className="py-2 px-3 text-right text-amber-400">{fmtCur(r.vl_aberto)}</td>
                  <td className="py-2 px-3 text-right text-red-300">{fmtCur(r.vl_vencido)}</td>
                  <td className="py-2 px-3 text-right text-blue-400">{fmtCur(r.vl_provisorio)}</td>
                  <td className="py-2 px-3 text-right text-gray-300">{fmtCur(r.vl_baixado)}</td>
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 bg-gray-800 rounded-full flex-1 overflow-hidden">
                        <div className="h-full bg-red-500/70 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                      <span className="text-xs text-gray-500 w-10 text-right">{pct.toFixed(1)}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}