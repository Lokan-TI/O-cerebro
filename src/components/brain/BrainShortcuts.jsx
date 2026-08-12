import { Link } from "react-router-dom";
import { ArrowRight, Database, BarChart3, UserPlus } from "lucide-react";

const LINKS = [
  { to: "/ErpCrmDashboard", icon: BarChart3, title: "Dashboard ERP" },
  { to: "/ConversaoNovosClientes", icon: UserPlus, title: "Conversão de Novos Clientes" },
  { to: "/GerenciarFontes", icon: Database, title: "Fontes de Dados" },
];

export default function BrainShortcuts() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {LINKS.map((s) => (
        <Link
          key={s.to}
          to={s.to}
          className="group flex items-center gap-2 rounded-full border border-gray-800 bg-gray-900/50 px-4 py-2 text-xs text-gray-400 transition-colors hover:border-purple-600/50 hover:text-gray-200"
        >
          <s.icon className="w-3.5 h-3.5 text-purple-400" />
          {s.title}
          <ArrowRight className="w-3 h-3 text-gray-600 group-hover:text-purple-400" />
        </Link>
      ))}
    </div>
  );
}