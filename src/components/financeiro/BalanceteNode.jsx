import { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { fmtCur, fmtNum } from "@/lib/erpFormat";

export default function BalanceteNode({ node, total, depth = 0 }) {
  const [open, setOpen] = useState(depth === 0);
  const children = node.children || [];
  const share = total ? (node.valor / total) * 100 : 0;
  const pad = ["pl-0", "pl-4", "pl-8", "pl-12"][depth] || "pl-12";

  return (
    <div>
      <div
        className={`grid grid-cols-12 gap-2 items-center py-2 border-b border-gray-800/60 ${
          depth === 0 ? "bg-gray-900/40" : ""
        }`}
      >
        <div className={`col-span-6 flex items-center gap-1 min-w-0 ${pad}`}>
          {children.length > 0 ? (
            <button onClick={() => setOpen(!open)} className="text-gray-500 hover:text-white shrink-0">
              {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          ) : (
            <span className="w-4 shrink-0" />
          )}
          <span className="text-xs text-gray-500 font-mono shrink-0">{node.code}</span>
          <span className={`text-sm truncate ${depth <= 1 ? "text-white font-medium" : "text-gray-300"}`}>
            {node.label}
          </span>
          <span className="text-xs text-gray-600 shrink-0">nível {node.nivel}</span>
        </div>
        <div className="col-span-2 text-right text-xs text-gray-500 tabular-nums">{fmtNum(node.qtd)}</div>
        <div className="col-span-2 text-right text-xs text-gray-500 tabular-nums">{share.toFixed(1)}%</div>
        <div className="col-span-2 text-right text-sm text-white tabular-nums pr-2">{fmtCur(node.valor)}</div>
      </div>
      {open && node.direto > 0 && (
        <div className={`grid grid-cols-12 gap-2 py-1.5 border-b border-gray-800/40 ${pad}`}>
          <div className="col-span-10 text-xs text-amber-400 pl-5">
            Lançado direto nesta conta sintética (sem detalhe analítico no ERP)
          </div>
          <div className="col-span-2 text-right text-xs text-amber-300 tabular-nums pr-2">{fmtCur(node.direto)}</div>
        </div>
      )}
      {open && children.map((c) => <BalanceteNode key={c.code} node={c} total={total} depth={depth + 1} />)}
    </div>
  );
}