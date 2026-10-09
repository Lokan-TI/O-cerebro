import { useState } from "react";
import { X, Search } from "lucide-react";
import { SEGMENTS } from "@/lib/rfm";
import { fmtCur } from "@/lib/erpFormat";

const DIM = { R: "Recência", F: "Frequência", M: "Valor Monetário" };

const fmtD = (d) => (d ? d.split("-").reverse().join("/") : "—");

export default function RfmClientList({ clients, sel, onClear, orcLoc = {} }) {
  const [q, setQ] = useState("");
  const title = sel.type === "seg" ? SEGMENTS[sel.key].label : `${DIM[sel.type]} ${sel.type}${sel.key}`;
  const list = clients
    .filter((c) => (sel.type === "seg" ? c.seg === sel.key : c[sel.type] === sel.key))
    .filter((c) => !q || (c.nm || "").toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.receita - a.receita);
  return (
    <div className="bg-gray-900 border border-purple-800/60 rounded-xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <p className="text-sm font-semibold text-white">{title} <span className="text-gray-400 font-normal">· {list.length.toLocaleString("pt-BR")} clientes</span></p>
        <div className="flex items-center gap-2">
          <div className="relative"><Search className="w-3.5 h-3.5 absolute left-2 top-2 text-gray-500" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente" className="bg-gray-800 border border-gray-700 rounded-md text-xs text-gray-200 pl-7 pr-2 py-1.5" /></div>
          <button onClick={onClear} className="p-1.5 rounded-md hover:bg-gray-800 text-gray-400"><X className="w-4 h-4" /></button>
        </div>
      </div>
      <div className="max-h-96 overflow-y-auto">
        <table className="text-xs">
          <thead><tr><th className="text-left text-gray-300">Cliente</th><th className="text-left text-gray-300">Segmento</th><th className="text-center text-gray-300">R</th><th className="text-center text-gray-300">F</th><th className="text-center text-gray-300">M</th><th className="text-right text-gray-300">Última NF</th><th className="text-right text-gray-300">Dias</th><th className="text-right text-gray-300">NFs</th><th className="text-right text-gray-300">Receita</th><th className="text-right text-gray-300">Orçamentos</th><th className="text-right text-gray-300">Locações</th><th className="text-right text-gray-300">Última locação</th></tr></thead>
          <tbody>
            {list.map((c, i) => (
              <tr key={i}>
                <td className="text-gray-200">{c.nm || "—"}</td>
                <td className="text-gray-300">{SEGMENTS[c.seg].label}</td>
                <td className="text-center text-gray-300">{c.R}</td><td className="text-center text-gray-300">{c.F}</td><td className="text-center text-gray-300">{c.M}</td>
                <td className="text-right text-gray-300">{c.ultima?.split("-").reverse().join("/")}</td>
                <td className="text-right text-gray-300">{c.dias}</td>
                <td className="text-right text-gray-300">{c.nfs}</td>
                <td className="text-right text-green-400">{fmtCur(c.receita)}</td>
                <td className="text-right text-amber-300">{orcLoc[c.id]?.orc ?? 0}</td>
                <td className="text-right text-sky-300">{orcLoc[c.id]?.loc ?? 0}</td>
                <td className="text-right text-gray-300">{fmtD(orcLoc[c.id]?.ultimaLoc)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}