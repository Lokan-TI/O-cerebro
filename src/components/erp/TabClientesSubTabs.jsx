import { useState } from "react";
import TabClientesPessoa from "@/components/erp/TabClientesPessoa";
import TabClientesPatrimonios from "@/components/erp/TabClientesPatrimonios";
import TabProdutosEquipamentos from "@/components/erp/TabProdutosEquipamentos";
import { Users, Package, Wrench } from "lucide-react";

const SUB_TABS = [
  { id: "lista", label: "Lista de clientes", icon: Users },
  { id: "patrimonios", label: "Patrimônios", icon: Package },
  { id: "equipamentos", label: "Produtos & Equipamentos", icon: Wrench },
];

export default function TabClientesSubTabs() {
  const [sub, setSub] = useState("lista");

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1 w-fit">
        {SUB_TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setSub(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                sub === t.id ? "bg-purple-600 text-white" : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {sub === "lista" && <TabClientesPessoa />}
      {sub === "patrimonios" && <TabClientesPatrimonios />}
      {sub === "equipamentos" && <TabProdutosEquipamentos />}
    </div>
  );
}