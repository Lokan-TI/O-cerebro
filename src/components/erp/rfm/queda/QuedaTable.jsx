import { Fragment, useEffect, useState } from "react";
import { prefetchDetalhes } from "./detailCache";
import { ChevronDown, ChevronRight } from "lucide-react";
import { STATUS, fmtD, fmtPct } from "./quedaCalc";
import QuedaFichaDetail from "./QuedaFichaDetail";

const COLS = [["nome", "Cliente"], ["status", "Status"], ["loc_a", "Fichas A"], ["loc_b", "Fichas B"], ["diff", "Dif."], ["pct", "Var. %"],
  ["ren_a", "Renov. A"], ["ren_b", "Renov. B"], ["orc_a", "Orç. A"], ["orc_b", "Orç. B"], ["ult_loc", "Última locação"], ["ult_orc", "Último orçamento"]];

export default function QuedaTable({ rows, params, sort, onSort }) {
  const [open, setOpen] = useState(null);
  const [limit, setLimit] = useState(100);
  // Carrega de uma vez as fichas dos primeiros clientes exibidos, para o detalhe abrir sem espera.
  const topIds = rows.slice(0, 40).map((c) => c.cd_pessoa).join(",");
  useEffect(() => { if (topIds) prefetchDetalhes(params, topIds.split(",")); }, [topIds, JSON.stringify(params)]);
  if (!rows.length) return <p className="text-sm text-gray-500 text-center py-10">Nenhum cliente neste filtro para os períodos comparados.</p>;
  const cell = (c, k) => {
    if (k === "status") return <span className={`px-2 py-0.5 rounded-full text-[11px] ${STATUS[c.status].cls}`}>{STATUS[c.status].label}</span>;
    if (k === "pct") return <span>{fmtPct(c.pct)}</span>;
    if (k === "ult_loc" || k === "ult_orc") return <span>{fmtD(c[k])}</span>;
    if (k !== "diff" && k !== "nome") return <span>{c[k]}</span>;
    if (k === "diff") return <span className={c.diff < 0 ? "text-red-300" : c.diff > 0 ? "text-emerald-300" : ""}>{c.diff > 0 ? `+${c.diff}` : c.diff}</span>;
    if (k === "ult_loc" || k === "ult_orc") return fmtD(c[k]);
    if (k === "nome") return <span className="text-white">{c.nome}</span>;
    return c[k];
  };
  return (
    <div className="overflow-auto max-h-[640px] rounded-lg border border-gray-800">
      <table className="text-xs text-gray-300">
        <thead><tr><th />{COLS.map(([k, l]) => (
          <th key={k} onClick={() => onSort(k)} className="cursor-pointer text-left text-gray-400 hover:text-white"><span>{l}{sort.key === k ? (sort.dir === 1 ? " ↑" : " ↓") : ""}</span></th>
        ))}</tr></thead>
        <tbody>
          {rows.slice(0, limit).map((c) => (
            <Fragment key={c.cd_pessoa}>
              <tr className="cursor-pointer" onClick={() => setOpen(open === c.cd_pessoa ? null : c.cd_pessoa)}>
                <td>{open === c.cd_pessoa ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}</td>
                {COLS.map(([k]) => <td key={k} className="whitespace-nowrap">{cell(c, k)}</td>)}
              </tr>
              {open === c.cd_pessoa && <tr><td /><td colSpan={COLS.length}><QuedaFichaDetail params={params} cdPessoa={c.cd_pessoa} /></td></tr>}
            </Fragment>
          ))}
        </tbody>
      </table>
      {rows.length > limit && <button onClick={() => setLimit(limit + 200)} className="w-full py-2 text-xs text-violet-300 hover:text-violet-200">Mostrar mais ({rows.length - limit} restantes)</button>}
    </div>
  );
}