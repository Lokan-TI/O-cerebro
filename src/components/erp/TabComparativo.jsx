import { useState } from "react";
import { useErpSnapshot } from "@/lib/ErpSnapshotContext";
import EmpresaFilter from "./EmpresaFilter";
import EmpresaComparisonTable from "./EmpresaComparisonTable";
import AnalyticsKpiCard from "./AnalyticsKpiCard";
import { Trophy, BarChart3, TrendingUp } from "lucide-react";
import { getEmpresaLabel } from "@/lib/empresaLabels";

const SUB_TABS = [
  { id: "financeiro", label: "KPIs Financeiros", icon: BarChart3 },
  { id: "comercial", label: "KPIs Comerciais", icon: Trophy },
];

const DETAIL_FINANCIAL = [
  { key: "fat_ano", label: "Faturamento NF Anual (YTD)", format: "currency", accent: "purple" },
  { key: "fat_mes", label: "Faturamento NF Mensal", format: "currency", accent: "blue" },
  { key: "crescimento_ano", label: "Crescimento Anual (YTD)", format: "percent", accent: "green" },
  { key: "crescimento_mes", label: "Crescimento Mensal (YoY)", format: "percent", accent: "cyan" },
  { key: "ticket_ano", label: "Ticket Médio Anual", format: "currency", accent: "indigo" },
  { key: "ticket_mes", label: "Ticket Médio Mensal", format: "currency", accent: "orange" },
  { key: "nfs_ano", label: "NFs Emitidas (Ano)", format: "number", accent: "yellow" },
  { key: "nfs_mes", label: "NFs Emitidas (Mês)", format: "number", accent: "emerald" },
];

const DETAIL_COMMERCIAL = [
  { key: "clientes_ano", label: "Clientes Ativos (Ano)", format: "number", accent: "purple" },
  { key: "clientes_mes", label: "Clientes Ativos (Mês)", format: "number", accent: "blue" },
  { key: "receita_por_cliente", label: "Faturamento por Cliente", format: "currency", accent: "green" },
  { key: "fat_ano", label: "Faturamento NF Total", format: "currency", accent: "cyan" },
  { key: "nfs_ano", label: "Volume de NFs", format: "number", accent: "indigo" },
  { key: "ticket_ano", label: "Ticket Médio", format: "currency", accent: "orange" },
];

export default function TabComparativo() {
  const { snapshot, loading } = useErpSnapshot();
  const [selectedEmpresa, setSelectedEmpresa] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState("financeiro");

  const byEmpresa = snapshot?.by_empresa || [];

  if (loading) {
    return <div className="text-gray-400 text-center py-12">Carregando dados...</div>;
  }

  if (byEmpresa.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 mb-2">Nenhum dado por empresa disponível.</p>
        <p className="text-gray-500 text-sm">Atualize os dados para extrair os KPIs por empresa.</p>
      </div>
    );
  }

  const selected = selectedEmpresa ? byEmpresa.find(e => e.cd_empresa === selectedEmpresa) : null;
  const detailKpis = activeSubTab === "financeiro" ? DETAIL_FINANCIAL : DETAIL_COMMERCIAL;
  const topEmpresa = byEmpresa[0];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <EmpresaFilter empresas={byEmpresa} selected={selectedEmpresa} onChange={setSelectedEmpresa} />
        <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1">
          {SUB_TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeSubTab === tab.id ? "bg-purple-600 text-white" : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {!selected && (
        <div className="flex items-center gap-2 text-gray-400 text-sm bg-gray-900/50 border border-gray-800 rounded-lg px-4 py-2.5">
          <TrendingUp className="w-4 h-4 text-green-400" />
          <span>Líder em faturamento NF: <strong className="text-white">{getEmpresaLabel(topEmpresa.cd_empresa, topEmpresa.nm_empresa)}</strong> — {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(topEmpresa.fat_ano)}</span>
        </div>
      )}

      {selected ? (
        <div>
          <div className="mb-4 pb-3 border-b border-gray-800">
            <h3 className="text-white text-lg font-bold">{getEmpresaLabel(selected.cd_empresa, selected.nm_empresa)}</h3>
            <p className="text-gray-400 text-sm">Código {selected.cd_empresa}</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {detailKpis.map(kpi => (
              <AnalyticsKpiCard
                key={kpi.key}
                label={kpi.label}
                value={selected[kpi.key]}
                format={kpi.format}
                accent={kpi.accent}
              />
            ))}
          </div>
        </div>
      ) : (
        <div>
          <div className="mb-3 flex items-center gap-2 text-gray-400 text-sm">
            <BarChart3 className="w-4 h-4" />
            <span>Comparativo lado a lado — destaques em verde indicam o melhor desempenho por KPI</span>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <EmpresaComparisonTable empresas={byEmpresa} mode={activeSubTab} />
          </div>
        </div>
      )}
    </div>
  );
}