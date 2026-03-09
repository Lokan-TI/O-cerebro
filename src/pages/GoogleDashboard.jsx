import { useState } from "react";
import TabGoogleOverview from "@/components/google/TabGoogleOverview.jsx";
import TabGoogleFunil from "@/components/google/TabGoogleFunil.jsx";
import TabGoogleRetencao from "@/components/google/TabGoogleRetencao.jsx";
import TabGoogleClientes from "@/components/google/TabGoogleClientes.jsx";

const TABS = [
  { id: "overview", label: "Visão Geral" },
  { id: "funil", label: "Funil & Conversão" },
  { id: "retencao", label: "Retenção & Recompra" },
  { id: "clientes", label: "Clientes WON" },
];

export default function GoogleDashboard() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-black border-b border-blue-700 px-6 py-4 flex items-center gap-4">
        <div className="w-1 h-10 bg-blue-500 rounded-full" />
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-blue-500 text-white text-xs font-bold px-2 py-0.5 rounded">GOOGLE ADS</span>
            <h1 className="text-2xl font-bold tracking-tight text-white">First-Touch · Retenção de Receita</h1>
          </div>
          <p className="text-gray-400 text-sm mt-0.5">Cohort de leads originados pelo Google — conversão, recompra e receita retida</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-black border-b border-gray-800 px-6 flex gap-0 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === t.id
                ? "border-blue-500 text-white"
                : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-6">
        {activeTab === "overview" && <TabGoogleOverview />}
        {activeTab === "funil" && <TabGoogleFunil />}
        {activeTab === "retencao" && <TabGoogleRetencao />}
        {activeTab === "clientes" && <TabGoogleClientes />}
      </div>
    </div>
  );
}