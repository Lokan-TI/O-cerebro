import { fmtNum, fmtCur } from "@/lib/erpFormat";
import { getEmpresaLabel } from "@/lib/empresaLabels";

export default function ProdutoPatrimonios({ patrimonios }) {
  if (!patrimonios.length) return <div className="text-xs text-gray-500 py-2">Produto sem patrimônio vinculado (controle por quantidade).</div>;
  return (
    <table className="text-xs">
      <thead>
        <tr className="text-gray-500">
          <th className="text-left">Patrimônio</th><th className="text-left">Empresa</th><th className="text-left">Situação</th>
          <th className="text-right">Locações</th><th className="text-right">Dias locados</th><th className="text-right">Receita estimada</th>
          <th className="text-right">Manutenção</th><th className="text-right">Resultado</th><th className="text-right">Receita/Manut.</th>
        </tr>
      </thead>
      <tbody>
        {patrimonios.map((a) => (
          <tr key={a.cd_patrimonio}>
            <td className="font-mono text-gray-200">{a.nr_patrimonio}{a.nr_serie && <span className="text-gray-500"> · {a.nr_serie}</span>}</td>
            <td className="text-gray-400">{a.cd_empresa ? getEmpresaLabel(a.cd_empresa) : "—"}</td>
            <td>
              {a.vendido ? <span className="text-gray-500">Vendido</span>
                : a.em_locacao ? <span className="text-emerald-400">Locado · {a.cliente_atual || "—"}{a.contrato_atual && ` (${a.contrato_atual})`}</span>
                : <span className="text-gray-400">Disponível</span>}
            </td>
            <td className="text-right text-gray-300">{fmtNum(a.qtd_locacoes)}</td>
            <td className="text-right text-gray-300">{fmtNum(a.dias_locados)}</td>
            <td className="text-right text-violet-300">{fmtCur(a.receita)}</td>
            <td className="text-right text-amber-300">{fmtCur(a.manutencao)}{a.qtd_os > 0 && <span className="text-gray-500"> · {a.qtd_os} OS</span>}</td>
            <td className={`text-right font-medium ${a.resultado >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmtCur(a.resultado)}</td>
            <td className="text-right text-gray-400">{a.manutencao > 0 ? `${(a.receita / a.manutencao).toFixed(1)}x` : "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}