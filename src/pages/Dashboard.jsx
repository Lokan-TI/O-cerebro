import { useState, useMemo } from "react";
import { RAW_LEADS } from "@/components/dashboard/leadsData";
import TabOverview from "@/components/dashboard/tabs/TabOverview.jsx";
import TabVendedores from "@/components/dashboard/tabs/TabVendedores.jsx";
import TabProdutos from "@/components/dashboard/tabs/TabProdutos.jsx";
import TabTemporal from "@/components/dashboard/tabs/TabTemporal.jsx";
import TabPrazo from "@/components/dashboard/tabs/TabPrazo.jsx";
import TabLeads from "@/components/dashboard/tabs/TabLeads.jsx";
import TabCanais from "@/components/dashboard/tabs/TabCanais.jsx";
import TabComparativo from "@/components/dashboard/tabs/TabComparativo.jsx";
import TabComparativoMeses from "@/components/dashboard/tabs/TabComparativoMeses.jsx";

const TABS = [
  { id: "overview", label: "Visão Geral" },
  { id: "vendedores", label: "Vendedores" },
  { id: "produtos", label: "Produtos / Canal" },
  { id: "temporal", label: "Análise Temporal" },
  { id: "prazo", label: "Prazos & Modalidades" },
  { id: "leads", label: "Lista de Leads" },
  { id: "canais", label: "Google vs. Outros" },
  { id: "comparativo", label: "Comparativo Mensal" },
  { id: "comparativoMeses", label: "Comparativo 2 Períodos" },
];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [filterVendedor, setFilterVendedor] = useState("Todos");
  const [filterMes, setFilterMes] = useState("Todos");

  const vendedores = useMemo(() => {
    const s = new Set(RAW_LEADS.map((l) => l.vendedor).filter(Boolean));
    return ["Todos", ...Array.from(s).sort()];
  }, []);

  const meses = useMemo(() => {
    const s = new Set(RAW_LEADS.map((l) => l.mes).filter(Boolean));
    return ["Todos", ...Array.from(s).sort()];
  }, []);

  const filtered = useMemo(() => {
    return RAW_LEADS.filter((l) => {
      const v = filterVendedor === "Todos" || l.vendedor === filterVendedor;
      const m = filterMes === "Todos" || l.mes === filterMes;
      return v && m;
    });
  }, [filterVendedor, filterMes]);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Sub-header com filtros */}
      <div className="bg-black border-b border-gray-800 px-6 py-3 flex items-center gap-3">
        <div className="w-1 h-8 bg-red-600 rounded-full" />
        <div>
          <h2 className="text-lg font-bold text-white">Leads Perdidos</h2>
          <p className="text-gray-500 text-xs">Análise completa de oportunidades não convertidas</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-gray-500 text-sm">{filtered.length} leads</span>
          <select
            value={filterVendedor}
            onChange={(e) => setFilterVendedor(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-white text-sm rounded px-2 py-1.5 focus:outline-none focus:border-red-500"
          >
            {vendedores.map((v) => <option key={v}>{v}</option>)}
          </select>
          <select
            value={filterMes}
            onChange={(e) => setFilterMes(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-white text-sm rounded px-2 py-1.5 focus:outline-none focus:border-red-500"
          >
            {meses.map((m) => <option key={m}>{m}</option>)}
          </select>
          {(filterVendedor !== "Todos" || filterMes !== "Todos") && (
            <button onClick={() => { setFilterVendedor("Todos"); setFilterMes("Todos"); }}
              className="text-red-400 text-xs hover:text-red-300 underline">Limpar</button>
          )}
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
                ? "border-red-600 text-white"
                : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === "overview" && <TabOverview data={filtered} />}
        {activeTab === "vendedores" && <TabVendedores data={filtered} />}
        {activeTab === "produtos" && <TabProdutos data={filtered} />}
        {activeTab === "temporal" && <TabTemporal data={filtered} />}
        {activeTab === "prazo" && <TabPrazo data={filtered} />}
        {activeTab === "leads" && <TabLeads data={filtered} />}
        {activeTab === "canais" && <TabCanais />}
        {activeTab === "comparativo" && <TabComparativo data={filtered} />}
        {activeTab === "comparativoMeses" && <TabComparativoMeses />}
      </div>
    </div>
  );
}