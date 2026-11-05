import { fmtCur, fmtNum } from "@/lib/erpFormat";

export default function CarKpis({ t }) {
  const items = [
    { label: "Total CAR", value: fmtCur(t.vl_total), sub: `${fmtNum(t.qtd)} títulos`, color: "text-white" },
    { label: "Liquidado", value: fmtCur(t.vl_liquidado), sub: "Recebido", color: "text-green-400" },
    { label: "A vencer", value: fmtCur(t.vl_a_vencer), sub: "Em aberto no prazo", color: "text-amber-400" },
    { label: "Vencido", value: fmtCur(t.vl_vencido), sub: "Sem baixa, venc. passado", color: "text-red-400" },
    { label: "Inadimplência", value: `${t.inad.toFixed(1)}%`, sub: "Vencido ÷ Total", color: "text-red-300" },
    { label: "Provisório", value: fmtCur(t.vl_provisorio), sub: "Fora do total", color: "text-blue-400" },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {items.map((i) => (
        <div key={i.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-xs text-gray-500 uppercase mb-1">{i.label}</div>
          <div className={`text-xl font-bold ${i.color}`}>{i.value}</div>
          <div className="text-xs text-gray-600 mt-1">{i.sub}</div>
        </div>
      ))}
    </div>
  );
}