import { useState } from "react";
import { ErpSnapshotProvider } from "@/lib/ErpSnapshotContext";
import RefreshHeader from "@/components/erp/RefreshHeader";
import SnapshotKpiGrid from "@/components/erp/SnapshotKpiGrid";
import TabComparativo from "@/components/erp/TabComparativo";
import SnapshotTables from "@/components/erp/SnapshotTables";
import QueryRunner from "@/components/erp/QueryRunner";
import SchemaExplorer from "@/components/erp/SchemaExplorer";
import TabChurn from "@/components/erp/TabChurn";
import TabClientesCar from "@/components/erp/TabClientesCar";
import TabVisaoGeral from "@/components/erp/TabVisaoGeral";
import TabFinanceiro from "@/components/erp/TabFinanceiro";
import TabLocacoes from "@/components/erp/TabLocacoes";
import TabOperacional from "@/components/erp/TabOperacional";
import TabClientesPessoa from "@/components/erp/TabClientesPessoa";
import TabClassificacao from "@/components/erp/TabClassificacao";
import { Link } from "react-router-dom";
import { Settings2 } from "lucide-react";
import { EmpresaFilterProvider } from "@/lib/EmpresaFilterContext";
import { GlobalFilterProvider } from "@/lib/GlobalFilterContext";
import TabExecutiva from "@/components/erp/TabExecutiva";
import TabCliente360 from "@/components/erp/TabCliente360";

const TABS = [
  { id: "executiva", label: "Visão Executiva" },
  { id: "visao_geral", label: "Visão Geral" },
  { id: "financeiro", label: "Financeiro" },
  { id: "locacoes", label: "Locações" },
  { id: "operacional", label: "Operacional" },
  { id: "clientes_pessoa", label: "Clientes" },
  { id: "cliente360", label: "Cliente 360" },
  { id: "classificacao", label: "Classificação" },
  { id: "comparativo", label: "Comparativo" },
  { id: "kpis", label: "KPIs Snapshot" },
  { id: "clientes_snapshot", label: "Clientes Snapshot" },
  { id: "churn", label: "Retenção & Churn" },
  { id: "car", label: "Clientes CAR" },
  { id: "estrutura", label: "Estrutura" },
  { id: "query", label: "Query SQL" },
];

function ErpCrmDashboardContent() {
  const [activeTab, setActiveTab] = useState("executiva");

  const renderTab = () => {
    switch (activeTab) {
      case "executiva": return <TabExecutiva />;
      case "visao_geral": return <TabVisaoGeral />;
      case "financeiro": return <TabFinanceiro />;
      case "locacoes": return <TabLocacoes />;
      case "operacional": return <TabOperacional />;
      case "clientes_pessoa": return <TabClientesPessoa />;
      case "cliente360": return <TabCliente360 />;
      case "classificacao": return <TabClassificacao />;
      case "comparativo": return <TabComparativo />;
      case "kpis": return <SnapshotKpiGrid />;
      case "clientes_snapshot": return <SnapshotTables />;
      case "churn": return <TabChurn />;
      case "car": return <TabClientesCar />;
      case "estrutura": return <SchemaExplorer />;
      case "query": return <QueryRunner />;
      default: return null;
    }
  };

  const content = renderTab();

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-7xl mx-auto">
        <RefreshHeader />

        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <div className="flex flex-wrap gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.id ? "bg-purple-600 text-white" : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <Link to="/GerenciarFontes" className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-400 hover:text-white text-xs transition-colors">
            <Settings2 className="w-3.5 h-3.5" /> Gerenciar fontes
          </Link>
        </div>

        {content}
      </div>
    </div>
  );
}

export default function ErpCrmDashboard() {
  return (
    <ErpSnapshotProvider>
      <EmpresaFilterProvider>
        <GlobalFilterProvider>
          <ErpCrmDashboardContent />
        </GlobalFilterProvider>
      </EmpresaFilterProvider>
    </ErpSnapshotProvider>
  );
}