import { useState, useMemo } from "react";
import KPICards from "../components/dashboard/KPICards";
import LeadsByVendedor from "../components/dashboard/LeadsByVendedor";
import LeadsByProduto from "../components/dashboard/LeadsByProduto";
import LeadsByMonth from "../components/dashboard/LeadsByMonth";
import LeadsTable from "../components/dashboard/LeadsTable";
import { RAW_LEADS } from "../components/dashboard/leadsData";

export default function Dashboard() {
  const [selectedVendedor, setSelectedVendedor] = useState("Todos");
  const [selectedMes, setSelectedMes] = useState("Todos");

  const vendedores = useMemo(() => {
    const set = new Set(RAW_LEADS.map((l) => l.vendedor).filter(Boolean));
    return ["Todos", ...Array.from(set).sort()];
  }, []);

  const meses = useMemo(() => {
    const set = new Set(RAW_LEADS.map((l) => l.mes).filter(Boolean));
    return ["Todos", ...Array.from(set).sort()];
  }, []);

  const filtered = useMemo(() => {
    return RAW_LEADS.filter((l) => {
      const v = selectedVendedor === "Todos" || l.vendedor === selectedVendedor;
      const m = selectedMes === "Todos" || l.mes === selectedMes;
      return v && m;
    });
  }, [selectedVendedor, selectedMes]);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-black border-b border-red-700 px-6 py-4 flex items-center gap-4">
        <div className="w-3 h-8 bg-red-600 rounded-sm" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Dashboard de Leads Perdidos</h1>
          <p className="text-gray-400 text-sm">Análise completa de oportunidades não convertidas</p>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <label className="text-gray-400 text-sm font-medium">Vendedor:</label>
            <select
              value={selectedVendedor}
              onChange={(e) => setSelectedVendedor(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white text-sm rounded-md px-3 py-2 focus:outline-none focus:border-red-500"
            >
              {vendedores.map((v) => <option key={v}>{v}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-gray-400 text-sm font-medium">Mês:</label>
            <select
              value={selectedMes}
              onChange={(e) => setSelectedMes(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white text-sm rounded-md px-3 py-2 focus:outline-none focus:border-red-500"
            >
              {meses.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          {(selectedVendedor !== "Todos" || selectedMes !== "Todos") && (
            <button
              onClick={() => { setSelectedVendedor("Todos"); setSelectedMes("Todos"); }}
              className="text-red-400 text-sm hover:text-red-300 underline"
            >
              Limpar filtros
            </button>
          )}
          <span className="ml-auto text-gray-500 text-sm">{filtered.length} leads encontrados</span>
        </div>

        {/* KPIs */}
        <KPICards data={filtered} />

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <LeadsByVendedor data={filtered} />
          <LeadsByProduto data={filtered} />
        </div>

        {/* Chart Row 2 */}
        <LeadsByMonth data={filtered} />

        {/* Table */}
        <LeadsTable data={filtered} />
      </div>
    </div>
  );
}