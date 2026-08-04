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
import { Link } from "react-router-dom";
import { Settings2 } from "lucide-react";

const TABS = [
  { id: "comparativo", label: "Comparativo" },
  { id: "kpis", label: "KPIs" },
  { id: "clientes", label: "Clientes" },
  { id: "churn", label: "Retenção & Churn" },
  { id: "car", label: "Clientes CAR" },
  { id: "estrutura", label: "Estrutura" },
  { id: "query", label: "Query SQL" },
];

function ErpCrmDashboardContent() {
  const [activeTab, setActiveTab] = useState("kpis");

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-7xl mx-auto">
        <RefreshHeader />

        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 overflow-x-auto">
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

        {activeTab === "comparativo" && <TabComparativo />}
        {activeTab === "kpis" && <SnapshotKpiGrid />}
        {activeTab === "clientes" && <SnapshotTables />}
        {activeTab === "churn" && <TabChurn />}
        {activeTab === "car" && <TabClientesCar />}
        {activeTab === "estrutura" && <SchemaExplorer />}
        {activeTab === "query" && <QueryRunner />}
      </div>
    </div>
  );
}

export default function ErpCrmDashboard() {
  return (
    <ErpSnapshotProvider>
      <ErpCrmDashboardContent />
    </ErpSnapshotProvider>
  );
}