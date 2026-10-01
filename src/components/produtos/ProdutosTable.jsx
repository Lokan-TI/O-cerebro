import { useState, Fragment } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { fmtNum, fmtCur } from "@/lib/erpFormat";
import ProdutoPatrimonios from "./ProdutoPatrimonios";

export default function ProdutosTable({ rows }) {
  const [open, setOpen] = useState({});
  const [limit, setLimit] = useState(200);
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-auto">
      <table className="text-sm">
        <thead>
          <tr className="text-gray-500">
            <th className="w-8"></th><th className="text-left">Código</th><th className="text-left">Produto</th><th className="text-left">Grupo / Família</th>
            <th className="text-right">Saldo</th><th className="text-right">Valor estoque</th><th className="text-right">Patrimônios</th>
            <th className="text-right">Locados</th><th className="text-right">Receita</th><th className="text-right">Manutenção</th><th className="text-right">Resultado</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, limit).map((p) => {
            const isOpen = !!open[p.cd_equipto];
            return (
              <Fragment key={p.cd_equipto}>
                <tr onClick={() => setOpen((s) => ({ ...s, [p.cd_equipto]: !isOpen }))} className="cursor-pointer">
                  <td className="text-gray-500">{isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</td>
                  <td className="font-mono text-xs text-gray-500">{p.codigo || p.cd_equipto}</td>
                  <td className="text-white">{p.nm_equipto || "—"}{!p.ativo && <span className="ml-2 text-[10px] text-gray-500">inativo</span>}</td>
                  <td className="text-xs text-gray-400">{p.grupo}<div className="text-gray-600">{p.familia}</div></td>
                  <td className={`text-right ${p.saldo > 0 ? "text-white" : "text-gray-600"}`}>{fmtNum(Math.round(p.saldo))}</td>
                  <td className="text-right text-gray-300">{fmtCur(p.valor_estoque)}</td>
                  <td className="text-right text-gray-300">{fmtNum(p.qtd_patrimonios)}</td>
                  <td className="text-right text-emerald-400">{fmtNum(p.qtd_locados)}</td>
                  <td className="text-right text-violet-300">{fmtCur(p.receita)}</td>
                  <td className="text-right text-amber-300">{fmtCur(p.manutencao)}</td>
                  <td className={`text-right font-medium ${p.resultado >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmtCur(p.resultado)}</td>
                </tr>
                {isOpen && (
                  <tr><td></td><td colSpan={10} className="bg-gray-950/60"><ProdutoPatrimonios patrimonios={p.patrimonios} /></td></tr>
                )}
              </Fragment>
            );
          })}
          {rows.length === 0 && <tr><td colSpan={11} className="text-center text-gray-600 py-6">Nenhum produto encontrado</td></tr>}
        </tbody>
      </table>
      {rows.length > limit && (
        <button onClick={() => setLimit((l) => l + 200)} className="w-full text-xs text-violet-300 hover:text-violet-200 py-2.5 border-t border-gray-800">
          Mostrar mais ({fmtNum(rows.length - limit)} restantes) — a exportação inclui todos
        </button>
      )}
    </div>
  );
}