import { useMemo } from "react";
import { fmtNum, fmtCur } from "@/lib/erpFormat";

export default function ProdutosFamiliaResumo({ produtos, campo, titulo }) {
  const linhas = useMemo(() => {
    const m = new Map();
    for (const p of produtos) {
      const k = p[campo];
      const g = m.get(k) || { nome: k, itens: 0, saldo: 0, valor: 0, receita: 0, manutencao: 0 };
      g.itens += 1; g.saldo += Math.max(p.saldo, 0); g.valor += p.valor_estoque;
      g.receita += p.receita; g.manutencao += p.manutencao;
      m.set(k, g);
    }
    return [...m.values()].sort((a, b) => b.valor - a.valor).slice(0, 12);
  }, [produtos, campo]);
  const max = Math.max(...linhas.map((l) => l.valor), 1);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="text-sm font-semibold text-white mb-3">{titulo}</div>
      <div className="space-y-2.5">
        {linhas.map((l) => (
          <div key={l.nome}>
            <div className="flex justify-between text-xs gap-2">
              <span className="text-gray-300 truncate">{l.nome}</span>
              <span className="text-gray-400 whitespace-nowrap">
                {fmtNum(Math.round(l.saldo))} pç · <span className="text-white">{fmtCur(l.valor)}</span>
              </span>
            </div>
            <div className="h-1.5 bg-gray-800 rounded mt-1 overflow-hidden">
              <div className="h-full bg-violet-500" style={{ width: `${Math.max((l.valor / max) * 100, 1)}%` }} />
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">
              {fmtNum(l.itens)} produtos · receita {fmtCur(l.receita)} · manutenção {fmtCur(l.manutencao)}
            </div>
          </div>
        ))}
        {linhas.length === 0 && <div className="text-xs text-gray-600">Sem dados</div>}
      </div>
    </div>
  );
}