import { useErpSnapshot } from "@/lib/ErpSnapshotContext";
import { useGlobalFilter } from "@/lib/GlobalFilterContext";
import { AlertTriangle, RefreshCw, Loader2 } from "lucide-react";

// Os dados analíticos são calculados no servidor para a janela usada na última atualização.
// Se o período aplicado for diferente, avisa e oferece recarregar os dados nessa janela.
export default function PeriodMismatchNotice() {
  const { snapshot, refreshing, refresh } = useErpSnapshot();
  const { period } = useGlobalFilter();
  const loaded = snapshot?.analytics_period;

  if (!loaded || !period) return null;
  // A janela carregada pode ser maior que a aplicada (ex.: histórico completo) — nesse caso
  // os dados já cobrem o período pedido. O fim aplicado é limitado à data de hoje.
  // Os números são calculados no servidor exatamente para a janela carregada:
  // qualquer diferença em relação ao período aplicado precisa de novo processamento.
  // Se a janela carregada cobre a aplicada, os dados já respondem ao filtro.
  if (loaded.start <= period.start && loaded.end >= period.end) return null;

  return (
    <div className="bg-amber-950 border border-amber-800 rounded-lg px-4 py-3 flex flex-wrap items-center gap-3">
      <AlertTriangle className="w-4 h-4 text-amber-400" />
      <span className="text-amber-200 text-sm">
        Os dados carregados são de {loaded.start} a {loaded.end}. O período aplicado ({period.start} a {period.end}) ainda não foi processado.
      </span>
      <button
        onClick={() => refresh({ period })}
        disabled={refreshing}
        className="flex items-center gap-2 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium"
      >
        {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        {refreshing ? "Carregando..." : "Carregar dados deste período"}
      </button>
    </div>
  );
}