import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { sumCurvas } from "@/lib/carRecuperacao";
import CarAgingCards from "@/components/financeiro/car/CarAgingCards";
import CarRecuperacaoChart from "@/components/financeiro/car/CarRecuperacaoChart";
import CarInadimplenciaChart from "@/components/financeiro/car/CarInadimplenciaChart";
import CarVencidosTable from "@/components/financeiro/car/CarVencidosTable";

// Sub-visão "Vencidos e recuperação" — já recebe as linhas filtradas por empresa.
export default function CarVencidosView({ curvas, titulos }) {
  const t = useMemo(() => sumCurvas(curvas || []), [curvas]);
  if (!curvas) return <div className="text-gray-500 p-8 text-center flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Carregando vencidos e curvas…</div>;
  return (
    <div className="space-y-4">
      <CarAgingCards t={t} />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <CarRecuperacaoChart curvas={curvas} />
        <CarInadimplenciaChart curvas={curvas} />
      </div>
      <CarVencidosTable titulos={titulos} />
    </div>
  );
}