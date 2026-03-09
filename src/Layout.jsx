import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";

const MENUS = [
  {
    id: "leads-perdidos",
    label: "Leads Perdidos",
    desc: "Análise de oportunidades não convertidas",
    page: "Dashboard",
    color: "red",
    badge: "PERDIDOS",
  },
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
];

const COLOR_MAP = {
  red: {
    border: "border-red-600",
    activeBg: "bg-red-600",
    activeText: "text-white",
    badge: "bg-red-700 text-red-100",
    dot: "bg-red-500",
    indicator: "bg-red-600",
  },
  blue: {
    border: "border-blue-500",
    activeBg: "bg-blue-600",
    activeText: "text-white",
    badge: "bg-blue-700 text-blue-100",
    dot: "bg-blue-500",
    indicator: "bg-blue-500",
  },
  green: {
    border: "border-green-500",
    activeBg: "bg-green-600",
    activeText: "text-white",
    badge: "bg-green-700 text-green-100",
    dot: "bg-green-500",
    indicator: "bg-green-500",
  },
};

export default function Layout({ children, currentPageName }) {
  const isGoogle = currentPageName === "GoogleDashboard";
  const accentColor = isGoogle ? "blue" : "red";
  const c = COLOR_MAP[accentColor];

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
                  ? `border-${m.color === "red" ? "red-600" : "blue-500"} text-white`
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
      </nav>

      {/* Page content */}
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}