import { useState } from "react";
import Integracoes from "@/pages/Integracoes";
import GerenciarFontes from "@/pages/GerenciarFontes";
import ArquivoSisloc from "@/pages/ArquivoSisloc";
import SchemaExplorer from "@/components/erp/SchemaExplorer";
import UsuariosTab from "@/components/config/UsuariosTab";

const TABS = [
  { id: "integracoes", label: "Integrações", el: <Integracoes /> },
  { id: "banco", label: "Banco de dados", el: <GerenciarFontes /> },
  { id: "usuarios", label: "Usuários", el: <div className="max-w-6xl mx-auto px-6 py-8"><UsuariosTab /></div> },
  { id: "arquivo", label: "Arquivo integral do Sisloc", el: <ArquivoSisloc /> },
  { id: "estrutura", label: "Estrutura do banco de dados", el: <div className="px-6 py-6"><SchemaExplorer /></div> },
];

export default function Configuracoes() {
  const initial = new URLSearchParams(window.location.search).get("tab");
  const [tab, setTab] = useState(TABS.some((t) => t.id === initial) ? initial : "integracoes");
  return (
    <div>
      <div className="px-6 pt-8 pr-20">
        <h1 className="text-2xl font-semibold text-white">Configurações</h1>
        <div className="mt-5 flex flex-wrap gap-1 border-b border-gray-800">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`px-4 py-2.5 text-sm border-b-2 -mb-px transition-colors ${tab === t.id ? "border-purple-500 text-white" : "border-transparent text-gray-500 hover:text-gray-300"}`}>{t.label}</button>
          ))}
        </div>
      </div>
      {TABS.find((t) => t.id === tab).el}
    </div>
  );
}