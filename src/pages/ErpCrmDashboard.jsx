import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { ErpSnapshotProvider } from "@/lib/ErpSnapshotContext";
import RefreshHeader from "@/components/erp/RefreshHeader";
import QueryRunner from "@/components/erp/QueryRunner";
import SchemaExplorer from "@/components/erp/SchemaExplorer";
import TabChurn from "@/components/erp/TabChurn";
import TabClientesCar from "@/components/erp/TabClientesCar";
import TabFinanceiro from "@/components/erp/TabFinanceiro";
import TabFornecedores from "@/components/erp/TabFornecedores";
import TabLocacoes from "@/components/erp/TabLocacoes";
import TabOperacional from "@/components/erp/TabOperacional";
import TabClientesSubTabs from "@/components/erp/TabClientesSubTabs";
import TabClassificacao from "@/components/erp/TabClassificacao";
import TabDicionario from "@/components/erp/TabDicionario";
import { Link } from "react-router-dom";
import { Settings2 } from "lucide-react";
import { EmpresaFilterProvider } from "@/lib/EmpresaFilterContext";
import { useAuth } from "@/lib/AuthContext";
import { GlobalFilterProvider } from "@/lib/GlobalFilterContext";
import TabExecutiva from "@/components/erp/TabExecutiva";
import TabCliente360 from "@/components/erp/TabCliente360";
import TabOnboardingFonte from "@/components/erp/TabOnboardingFonte";
import TabReconciliacaoReceita from "@/components/erp/TabReconciliacaoReceita";
import TabIdentidadeParty from "@/components/erp/TabIdentidadeParty";
import TabCamadaSemantica from "@/components/erp/TabCamadaSemantica";
import TabReconciliacaoMetricas from "@/components/erp/TabReconciliacaoMetricas";

const TABS = [
  { id: "executiva", label: "Visão Executiva" },
  { id: "financeiro", label: "Financeiro" },
  { id: "fornecedores", label: "Fornecedores" },
  { id: "locacoes", label: "Locações" },
  { id: "operacional", label: "Operacional" },
  { id: "clientes_pessoa", label: "Clientes" },
  { id: "cliente360", label: "Cliente 360" },
  { id: "classificacao", label: "Classificação" },
  { id: "churn", label: "Retenção & Churn" },
  { id: "car", label: "Clientes CAR" },
  { id: "dicionario", label: "Dicionário" },
  { id: "estrutura", label: "Estrutura" },
  { id: "onboarding", label: "Onboarding da Fonte", adminOnly: true },
  { id: "reconciliacao", label: "Reconciliação Receita", adminOnly: true },
  { id: "identidade", label: "Identidade (Party)", adminOnly: true },
  { id: "semantica", label: "Camada Semântica", adminOnly: true },
  { id: "recon_metricas", label: "Recon. Métricas", adminOnly: true },
  { id: "query", label: "Query SQL", adminOnly: true },
];

function ErpCrmDashboardContent() {
  const location = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const visibleTabs = TABS.filter((t) => !t.adminOnly || isAdmin);
  const [activeTab, setActiveTab] = useState(
    () => new URLSearchParams(window.location.search).get("tab") || "executiva"
  );

  useEffect(() => {
    const tab = new URLSearchParams(location.search).get("tab");
    if (tab && TABS.some((t) => t.id === tab)) setActiveTab(tab);
  }, [location.search]);

  const renderTab = () => {
    switch (activeTab) {
      case "executiva": return <TabExecutiva />;
      case "financeiro": return <TabFinanceiro />;
      case "fornecedores": return <TabFornecedores />;
      case "locacoes": return <TabLocacoes />;
      case "operacional": return <TabOperacional />;
      case "clientes_pessoa": return <TabClientesSubTabs />;
      case "cliente360": return <TabCliente360 />;
      case "classificacao": return <TabClassificacao />;
      case "churn": return <TabChurn />;
      case "car": return <TabClientesCar />;
      case "dicionario": return <TabDicionario />;
      case "estrutura": return <SchemaExplorer />;
      case "onboarding": return isAdmin ? <TabOnboardingFonte /> : null;
      case "reconciliacao": return isAdmin ? <TabReconciliacaoReceita /> : null;
      case "identidade": return isAdmin ? <TabIdentidadeParty /> : null;
      case "semantica": return isAdmin ? <TabCamadaSemantica /> : null;
      case "recon_metricas": return isAdmin ? <TabReconciliacaoMetricas /> : null;
      case "query": return isAdmin ? <QueryRunner /> : null;
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
            {visibleTabs.map(tab => (
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