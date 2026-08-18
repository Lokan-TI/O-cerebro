import { fmtCur, fmtNum } from "@/lib/erpFormat";
import { Boxes, Layers, Wrench, TrendingDown, ShoppingCart, Landmark } from "lucide-react";

function Card({ icon: Icon, label, value, hint }) {
  return (
    <div className="border border-gray-800 bg-gray-900/60 rounded-xl p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-400">
        <Icon className="w-4 h-4" /> {label}
      </div>
      <div className="text-lg xl:text-xl font-bold text-white mt-2 whitespace-nowrap">{value}</div>
      {hint && <div className="text-xs text-gray-500 mt-1">{hint}</div>}
    </div>
  );
}

export default function AtivosKpiCards({ grupos, ranking, cap }) {
  const patr = grupos.reduce((s, g) => s + g.vl_patrimonio, 0);
  const est = grupos.reduce((s, g) => s + g.vl_estoque, 0);
  const manut = grupos.reduce((s, g) => s + g.manutencao_12m, 0);
  const dep = ranking.reduce((s, r) => s + r.depreciacao, 0);
  const pecas = grupos.reduce((s, g) => s + g.qt_estoque, 0);
  const patrQtd = grupos.reduce((s, g) => s + g.patrimonios, 0);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
      <Card icon={Boxes} label="Capital imobilizado total" value={fmtCur(patr + est)} hint={`${fmtNum(grupos.length)} famílias de ativo`} />
      <Card icon={Layers} label="Equipamentos patrimoniados" value={fmtCur(patr)} hint={`${fmtNum(patrQtd)} patrimônios ativos`} />
      <Card icon={Boxes} label="Estruturas por quantidade" value={fmtCur(est)} hint={`${fmtNum(pecas)} peças (andaime, multidirecional, escoramento)`} />
      <Card icon={Wrench} label="Manutenção 12 meses" value={fmtCur(manut)} hint={`${((manut / (patr + est || 1)) * 100).toFixed(1)}% do valor do ativo`} />
      <Card icon={TrendingDown} label="Depreciação anual estimada" value={fmtCur(dep)} hint="Linear pela vida útil de referência por família" />
      <Card icon={cap ? ShoppingCart : Landmark} label="Custo total pago 12m (CAP)" value={fmtCur(cap?.total || 0)} hint={`CAPEX ${fmtCur(cap?.capex || 0)} · OPEX ${fmtCur(cap?.opex || 0)}`} />
    </div>
  );
}