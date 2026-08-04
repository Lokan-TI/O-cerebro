import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Settings } from "lucide-react";

const MENUS = [
  {
    id: "google-leads",
    label: "Google · First-Touch",
    desc: "Conversão, recompra e receita retida",
    page: "GoogleDashboard",
    color: "blue",
    badge: "GOOGLE ADS",
  },
  {
    id: "funil",
    label: "Funil de Conversão",
    desc: "Análise detalhada do funil por vendedor",
    page: "FunilConversao",
    color: "green",
    badge: "FUNIL",
  },
  {
    id: "leads-perdidos",
    label: "Leads Perdidos",
    desc: "Análise completa de oportunidades não convertidas",
    page: "Dashboard",
    color: "red",
    badge: "PERDIDOS",
  },
  {
    id: "erp",
    label: "ERP",
    desc: "KPIs em tempo real do ERP",
    page: "ErpCrmDashboard",
    color: "purple",
    badge: "ERP",
  },
];

const COLOR_MAP = {
  red: {
    border: "border-red-600",
    badge: "bg-red-700 text-red-100",
    dot: "bg-red-500",
  },
  blue: {
    border: "border-blue-500",
    badge: "bg-blue-700 text-blue-100",
    dot: "bg-blue-500",
  },
  green: {
    border: "border-green-500",
    badge: "bg-green-700 text-green-100",
    dot: "bg-green-500",
  },
  purple: {
    border: "border-purple-500",
    badge: "bg-purple-700 text-purple-100",
    dot: "bg-purple-500",
  },
};

export default function Layout({ children, currentPageName }) {
  const isFunil = currentPageName === "FunilConversao";
  const isErpCrm = currentPageName === "ErpCrmDashboard";
  const accentColor = isFunil ? "green" : isErpCrm ? "purple" : "blue";
  const c = COLOR_MAP[accentColor];
  const isGoogleDashboard = currentPageName === "GoogleDashboard";

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Top nav */}
      <nav className={`bg-black border-b ${c.border} px-4 py-0 flex items-center gap-1 shrink-0`}>
        {/* Logo */}
        <div className="flex items-center gap-2 pr-6 py-3 border-r border-gray-800 mr-2">
          <div className={`w-2 h-2 rounded-full ${c.dot}`} />
          <span className="text-white font-bold text-sm tracking-tight">Sales Analytics</span>
        </div>

        {/* Menu items */}
        {MENUS.map((m) => {
          const active = currentPageName === m.page;
          const mc = COLOR_MAP[m.color];
          return (
            <Link
              key={m.id}
              to={createPageUrl(m.page)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                active
                  ? `border-${m.color === "green" ? "green-500" : m.color === "purple" ? "purple-500" : "blue-500"} text-white`
                  : "border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-600"
              }`}
            >
              <span
                className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                  active ? mc.badge : "bg-gray-800 text-gray-400"
                }`}
              >
                {m.badge}
              </span>
              {m.label}
            </Link>
          );
        })}

        {/* Botão Importar Dados — só no Google Dashboard */}
        {isGoogleDashboard && (
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("open-import-modal"))}
            className="ml-auto flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white rounded-lg text-xs font-medium transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
            Importar Dados
          </button>
        )}
      </nav>

      {/* Page content */}
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}