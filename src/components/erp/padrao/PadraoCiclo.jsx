import { CicloBadge, TendenciaBadge } from "./PadraoBadges";
import { fmtData } from "./padraoApi";

export default function PadraoCiclo({ p }) {
  if (!p) return null;
  const item = (l, v) => <div><div className="text-[11px] text-gray-500">{l}</div><div className="text-white text-sm">{v}</div></div>;
  return (
    <div className={`rounded-lg border p-4 space-y-3 ${p.oportunidade_comercial ? "border-amber-600/60 bg-amber-950/20" : "border-gray-800"}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <h4 className="text-white text-sm font-semibold">Ciclo de locação</h4>
        <CicloBadge value={p.ciclo_status} /> <TendenciaBadge value={p.tendencia} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {item("Intervalo médio", p.intervalo_medio_dias != null ? `${p.intervalo_medio_dias} dias` : "—")}
        {item("Última ficha", fmtData(p.ultima_ficha))}
        {item("Dias desde a última", p.dias_desde_ultima ?? "—")}
        {item("Fichas 3m / 3m ant.", `${p.fichas_ultimos_3m} / ${p.fichas_3m_anteriores}`)}
      </div>
      {p.oportunidade_comercial && (
        <p className="text-amber-200 text-sm">
          {p.ciclo_status === "CICLO_VENCIDO" || p.ciclo_status === "APROXIMANDO_CICLO"
            ? `Cliente historicamente aluga a cada ${p.intervalo_medio_dias} dias; já se passaram ${p.dias_desde_ultima} dias desde a última locação — oportunidade de contato.`
            : `Frequência em queda: ${p.fichas_ultimos_3m} fichas nos últimos 3 meses contra ${p.fichas_3m_anteriores} nos 3 anteriores — oportunidade de contato.`}
        </p>
      )}
    </div>
  );
}