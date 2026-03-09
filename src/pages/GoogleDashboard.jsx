import { useState } from "react";
import TabGoogleOverview from "@/components/google/TabGoogleOverview.jsx";
import TabGoogleFunil from "@/components/google/TabGoogleFunil.jsx";
import TabGoogleRetencao from "@/components/google/TabGoogleRetencao.jsx";
import TabGoogleClientes from "@/components/google/TabGoogleClientes.jsx";
import TabProjecaoReceita from "@/components/google/TabProjecaoReceita.jsx";

const TABS = [
  { id: "overview",  label: "Visão Geral" },
  { id: "funil",     label: "Funil Cohort" },
  { id: "retencao",  label: "Retenção" },
  { id: "clientes",  label: "Clientes WON" },
  { id: "projecao",  label: "Projeção de Receita" },
];

export default function GoogleDashboard() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-xs font-bold bg-blue-600 text-white px-2 py-0.5 rounded uppercase tracking-wider">Google Ads</span>
            <h1 className="text-white font-bold text-xl">First-Touch Analytics</h1>
          </div>
          <p className="text-gray-500 text-sm">Cohort de leads com origem Google · Jan–Nov 2025</p>
        </div>

        {/* Tab nav */}
        <div className="flex gap-1 mb-6 bg-gray-900 border border-gray-800 rounded-xl p-1 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {activeTab === "overview"  && <TabGoogleOverview />}
        {activeTab === "funil"     && <TabGoogleFunil />}
        {activeTab === "retencao"  && <TabGoogleRetencao />}
        {activeTab === "clientes"  && <TabGoogleClientes />}
      </div>
    </div>
  );
}