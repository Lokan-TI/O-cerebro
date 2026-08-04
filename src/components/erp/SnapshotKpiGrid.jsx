import { useErpSnapshot } from "@/lib/ErpSnapshotContext";
import { Database } from "lucide-react";

const KPI_CONFIG = [
  { key: "fat_ano", label: "Faturamento Ano", format: "currency", accent: "border-blue-500", sub: "Acumulado " + new Date().getFullYear() },
  { key: "fat_mes", label: "Faturamento Mês", format: "currency", accent: "border-purple-500", sub: "Mês atual · vl_faturamento" },
  { key: "ticket_ano", label: "Ticket Médio", format: "currency", accent: "border-green-500", sub: "Por NF no ano" },
  { key: "nfs_ano", label: "NFs no Ano", format: "number", accent: "border-yellow-500", sub: "Notas emitidas" },
  { key: "clientes_ano", label: "Clientes no Ano", format: "number", accent: "border-cyan-500", sub: "Clientes únicos" },
  { key: "clientes_mes", label: "Clientes no Mês", format: "number", accent: "border-indigo-500", sub: "Ativos no mês" },
  { key: "concentracao_top10", label: "Concentração Top 10", format: "percent", accent: "border-red-500", sub: "Risco de concentração" },
  { key: "crescimento_ano", label: "Crescimento Ano (YTD)", format: "percent", accent: "border-emerald-500", sub: "vs. mesmo período ano anterior" },
];

function fmtValue(v, format) {
  if (v == null) return "—";
  const n = typeof v === "number" ? v : parseFloat(v);
  if (isNaN(n)) return String(v);
  if (format === "currency") return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  if (format === "percent") return (n >= 0 ? "+" : "") + n.toFixed(1) + "%";
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

export default function SnapshotKpiGrid() {
  const { snapshot, loading } = useErpSnapshot();
  const kpis = snapshot?.kpis || {};

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-gray-900 border border-gray-800 rounded-lg p-4 h-28 animate-pulse">
            <div className="h-3 bg-gray-800 rounded w-2/3 mb-3" />
            <div className="h-7 bg-gray-800 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
        <Database className="w-12 h-12 text-gray-700 mx-auto mb-3" />
        <h3 className="text-white font-semibold mb-1">Nenhum dado disponível</h3>
        <p className="text-gray-500 text-sm">Clique em "Atualizar dados" para extrair os indicadores do ERP e gerar a primeira versão.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {KPI_CONFIG.map(kpi => (
        <div key={kpi.key} className={`bg-gray-900 border-l-4 ${kpi.accent} rounded-lg p-4`}>
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">{kpi.label}</p>
          <p className="text-2xl font-bold text-white">{fmtValue(kpis[kpi.key], kpi.format)}</p>
          {kpi.sub && <p className="text-gray-500 text-xs mt-1">{kpi.sub}</p>}
        </div>
      ))}
    </div>
  );
}