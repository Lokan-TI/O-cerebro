import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { fmtCur } from "@/lib/erpFormat";
import { getEmpresaLabel } from "@/lib/empresaLabels";

const br = (d) => (d ? d.split("-").reverse().join("/") : "");
const diasColor = (d) => (d > 180 ? "text-red-400" : d > 60 ? "text-amber-400" : "text-gray-300");

// Lista dos títulos vencidos em aberto (maior valor primeiro), com busca por cliente ou NF.
export default function CarVencidosTable({ titulos }) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? titulos.filter((t) => t.cliente.toLowerCase().includes(s) || String(t.nf_numero).includes(s)) : titulos;
  }, [titulos, q]);
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="text-white font-semibold text-sm">Títulos vencidos em aberto <span className="text-gray-500 font-normal">({list.length})</span></h3>
        <div className="relative">
          <Search className="w-4 h-4 text-gray-500 absolute left-2.5 top-2.5" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cliente ou NF" className="bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-3 py-2 text-sm text-white w-56" />
        </div>
      </div>
      <div className="overflow-auto max-h-[480px]">
        <table className="w-full text-sm">
          <thead><tr className="text-gray-500 text-xs uppercase">
            <th className="text-left">Cliente</th><th className="text-left">Empresa</th><th className="text-left">NF</th>
            <th className="text-left">Emissão</th><th className="text-left">Vencimento</th><th className="text-right">Dias</th><th className="text-right">Valor</th>
          </tr></thead>
          <tbody>
            {list.map((t) => (
              <tr key={t.cd_lan}>
                <td className="text-white">{t.cliente || `Cliente ${t.cd_pessoa}`}</td>
                <td className="text-gray-400">{t.cd_empresa == null ? "—" : getEmpresaLabel(t.cd_empresa)}</td>
                <td className="text-gray-400">{t.nf_numero}</td>
                <td className="text-gray-400">{br(t.emissao)}</td>
                <td className="text-gray-300">{br(t.vencimento)}</td>
                <td className={`text-right ${diasColor(t.dias)}`}>{t.dias}</td>
                <td className="text-right text-red-300 font-medium">{fmtCur(t.valor)}</td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={7} className="text-center text-gray-600 py-6">Nenhum título vencido.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}