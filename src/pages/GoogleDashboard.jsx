import { useState, useEffect } from "react";
import TabGoogleOverview from "@/components/google/TabGoogleOverview.jsx";
import TabGoogleFunil from "@/components/google/TabGoogleFunil.jsx";
import TabGoogleRetencao from "@/components/google/TabGoogleRetencao.jsx";
import TabGoogleClientes from "@/components/google/TabGoogleClientes.jsx";
import TabProjecaoReceita from "@/components/google/TabProjecaoReceita.jsx";
import ImportModal from "@/components/google/ImportModal.jsx";
import { CATEGORIAS } from "@/components/google/googleData.jsx";
import DateRangeFilter, { DATE_RANGE_DEFAULT } from "@/components/google/DateRangeFilter.jsx";

const TABS = [
  { id: "overview",  label: "Visão Geral" },
  { id: "funil",     label: "Funil Cohort" },
  { id: "retencao",  label: "Retenção" },
  { id: "clientes",  label: "Clientes WON" },
  { id: "projecao",  label: "Projeção de Receita" },
];

const CATEGORIA_COLORS = {
  "Todos":     "bg-blue-600 text-white",
  "Translift": "bg-orange-600 text-white",
  "Elétrico":  "bg-green-600 text-white",
  "Diesel":    "bg-yellow-600 text-gray-900",
  "Outros":    "bg-gray-600 text-white",
};

const FILTERED_TABS = ["funil", "retencao", "projecao"];

export default function GoogleDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [categoria, setCategoria] = useState("Todos");
  const [showImport, setShowImport] = useState(false);
  const [dateRange, setDateRange] = useState(DATE_RANGE_DEFAULT);

  useEffect(() => {
    const handler = () => setShowImport(true);
    window.addEventListener("open-import-modal", handler);
    return () => window.removeEventListener("open-import-modal", handler);
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImport={(rows) => console.log("Dados importados:", rows)}
        />
      )}
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-xs font-bold bg-blue-600 text-white px-2 py-0.5 rounded uppercase tracking-wider">Google Ads</span>
              <h1 className="text-white font-bold text-xl">First-Touch Analytics</h1>
            </div>
            <p className="text-gray-500 text-sm">Cohort de leads com origem Google · Jan–Nov 2025</p>
          </div>

          {/* Filtro global de categoria */}
          <div className="flex items-center gap-3 flex-wrap">
            {FILTERED_TABS.includes(activeTab) && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-gray-500 text-xs uppercase tracking-wider">Categoria:</span>
                {CATEGORIAS.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCategoria(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      categoria === cat
                        ? CATEGORIA_COLORS[cat]
                        : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>
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
        {activeTab === "funil"     && <TabGoogleFunil categoria={categoria} />}
        {activeTab === "retencao"  && <TabGoogleRetencao categoria={categoria} />}
        {activeTab === "clientes"  && <TabGoogleClientes />}
        {activeTab === "projecao"  && <TabProjecaoReceita categoria={categoria} />}
      </div>
    </div>
  );
}