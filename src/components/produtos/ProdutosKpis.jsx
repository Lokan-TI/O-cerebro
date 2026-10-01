import { fmtNum, fmtCur } from "@/lib/erpFormat";

export default function ProdutosKpis({ produtos }) {
  const pats = produtos.flatMap((p) => p.patrimonios);
  const sum = (arr, k) => arr.reduce((t, x) => t + (x[k] || 0), 0);
  const cards = [
    ["Produtos cadastrados", fmtNum(produtos.length)],
    ["Com saldo", fmtNum(produtos.filter((p) => p.saldo > 0).length)],
    ["Zerados", fmtNum(produtos.filter((p) => p.saldo <= 0).length)],
    ["Sem patrimônio", fmtNum(produtos.filter((p) => p.qtd_patrimonios === 0).length)],
    ["Valor em estoque", fmtCur(sum(produtos, "valor_estoque"))],
    ["Ativos locados agora", `${fmtNum(pats.filter((a) => a.em_locacao).length)} / ${fmtNum(pats.length)}`],
    ["Receita estimada (ativos)", fmtCur(sum(pats, "receita"))],
    ["Custo de manutenção", fmtCur(sum(pats, "manutencao"))],
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
      {cards.map(([label, value]) => (
        <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
          <div className="text-lg font-semibold text-white mt-1 truncate">{value}</div>
        </div>
      ))}
    </div>
  );
}