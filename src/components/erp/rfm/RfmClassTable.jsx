import { SEGMENTS } from "@/lib/rfm";
import { fmtCur } from "@/lib/erpFormat";

export default function RfmClassTable({ segs }) {
  const rows = Object.entries(segs).map(([k, v]) => ({ k, ...v })).sort((a, b) => b.receita - a.receita);
  const maxR = Math.max(1, ...rows.map((r) => r.receita)), maxQ = Math.max(1, ...rows.map((r) => r.qtd));
  return (
    <table className="text-xs">
      <thead><tr><th className="text-left text-gray-300">Classificação</th><th className="text-right text-gray-300">Receita</th><th className="text-right text-gray-300">Qtde. clientes</th></tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.k}>
            <td className="text-gray-200"><span className={`inline-block w-2 h-2 rounded-full mr-2 ${SEGMENTS[r.k].color}`} />{SEGMENTS[r.k].label}</td>
            <td className="text-right text-gray-200 relative"><div className="absolute inset-y-1 left-0 bg-purple-500/20 rounded" style={{ width: `${(r.receita / maxR) * 100}%` }} /><span className="relative">{fmtCur(r.receita)}</span></td>
            <td className="text-right text-gray-200 relative"><div className="absolute inset-y-1 left-0 bg-gray-500/20 rounded" style={{ width: `${(r.qtd / maxQ) * 100}%` }} /><span className="relative">{r.qtd.toLocaleString("pt-BR")}</span></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}