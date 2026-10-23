import { TendenciaBadge, CicloBadge } from "./PadraoBadges";
import { fmtData } from "./padraoApi";

export default function PadraoCells({ p, loading }) {
  const empty = <td className="py-2 px-3 text-right text-gray-600 text-xs">{loading ? "…" : "—"}</td>;
  if (!p) return <>{empty}{empty}{empty}{empty}{empty}</>;
  return (
    <>
      <td className="py-2 px-3 text-right text-gray-300">{p.media_fichas_mes.toFixed(2)}</td>
      <td className="py-2 px-3 text-right text-gray-300">{p.equipamentos_no_cliente}</td>
      <td className="py-2 px-3 text-right text-xs text-gray-400 whitespace-nowrap">
        {fmtData(p.ultima_ficha)}
        {p.dias_desde_ultima != null && <div className="text-gray-600">{p.dias_desde_ultima} dias</div>}
      </td>
      <td className="py-2 px-3"><TendenciaBadge value={p.tendencia} /></td>
      <td className="py-2 px-3"><CicloBadge value={p.ciclo_status} /></td>
    </>
  );
}