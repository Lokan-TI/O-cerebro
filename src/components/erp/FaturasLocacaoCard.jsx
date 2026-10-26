import { Receipt } from "lucide-react";
import { fmtCur, fmtNum } from "@/lib/erpFormat";

export default function FaturasLocacaoCard({ rows, error, selectedEmpresa }) {
  const scoped = (rows || []).filter((r) => selectedEmpresa == null || Number(r.cd_empresa) === Number(selectedEmpresa));
  const valor = scoped.reduce((s, r) => s + (Number(r.valor) || 0), 0);
  const qt = scoped.reduce((s, r) => s + (Number(r.faturas) || 0), 0);
  return (
    <div className="rounded-xl border border-amber-700/40 bg-amber-950/30 p-4">
      <div className="flex items-center gap-2 mb-2"><Receipt className="w-4 h-4 text-amber-400" /><span className="text-xs text-gray-400 uppercase">Faturamento sob Faturas de Locação</span></div>
      <div className="text-2xl font-bold text-white">{error ? "—" : rows ? fmtCur(valor) : "…"}</div>
      <div className="text-xs text-gray-500 mt-1">{error ? `Erro: ${error}` : rows ? `${fmtNum(qt)} faturas geradas no período · por data de geração (Sisloc)` : "Carregando faturas…"}</div>
    </div>
  );
}