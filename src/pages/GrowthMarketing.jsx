import { useMemo, useState } from "react";
import { useBrainSnapshot } from "@/components/brain/useBrainSnapshot";
import { buildDecisionKpis } from "@/lib/decisionKpis";
import DecisionSection from "@/components/decision/DecisionSection";
import EmpresaSelect from "@/components/decision/EmpresaSelect";
import EmpresaComparison from "@/components/decision/EmpresaComparison";
import { scopeSnapshotByEmpresa, empresaOptions } from "@/lib/scopeSnapshot";
import { Loader2, Rocket } from "lucide-react";

export default function GrowthMarketing() {
  const { snapshot, loading, source } = useBrainSnapshot();
  const [empresa, setEmpresa] = useState(null);
  const options = useMemo(() => empresaOptions(snapshot), [snapshot]);
  const dept = useMemo(
    () => buildDecisionKpis(scopeSnapshotByEmpresa(snapshot, empresa)).find((d) => d.id === "growth"),
    [snapshot, empresa]
  );

  return (
    <div className="min-h-screen bg-gray-950 px-6 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 pr-14 flex items-start justify-between gap-4">
          <div>
          <div className="flex items-center gap-2">
            <Rocket className="w-5 h-5 text-purple-400" />
            <h1 className="text-2xl font-bold text-white">Growth Marketing</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Demanda, eficiência de frota e retenção de contas frente aos benchmarks do setor
            {source?.name ? ` · base ${source.name}` : ""}
            {snapshot?.max_date ? ` · dados até ${snapshot.max_date}` : ""}
          </p>
          </div>
          <div className="shrink-0">
            <EmpresaSelect value={empresa} onChange={setEmpresa} options={options} />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-gray-500 text-sm py-16">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando indicadores…
          </div>
        ) : !dept ? (
          <p className="text-gray-500 text-sm py-16">
            Nenhum dado disponível. Atualize os dados em Configuração de dados.
          </p>
        ) : (
          <>
            <DecisionSection dept={dept} editing={false} hiddenIds={[]} onToggle={() => {}} />
            <EmpresaComparison snapshot={snapshot} />
          </>
        )}
      </div>
    </div>
  );
}