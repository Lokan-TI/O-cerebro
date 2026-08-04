import { useState, useMemo } from "react";
import { Search, Database, ChevronDown, ChevronRight, Star } from "lucide-react";

const MODULE_NAMES = {
  acesso: "Acesso / Segurança",
  est: "Estoque",
  cad: "Cadastro",
  compra: "Compras",
  nf: "Notas Fiscais",
  nfe: "NF-e",
  nfserv: "NF Serviços",
  nftotal: "NF Totais",
  conta: "Contas",
  contabil: "Contábil",
  banco: "Banco",
  patrimon: "Patrimônio",
  mov: "Movimentações",
  pessoa: "Pessoas",
  venda: "Vendas",
  pedido: "Pedidos",
  produto: "Produtos",
  grupo: "Grupos",
  fiscal: "Fiscal",
  financeiro: "Financeiro",
  cr: "Contas a Receber",
  cp: "Contas a Pagar",
  projeto: "Projetos",
  aplicacao: "Aplicações",
  audit: "Auditoria",
  arq: "Arquivo",
  autoriz: "Autorizações",
  anot: "Anotações",
  rel: "Relatórios",
  config: "Configurações",
  import: "Importação",
  exp: "Exportação",
  log: "Logs",
  integracao: "Integrações",
};

function getPrefix(name) {
  const idx = name.indexOf("_");
  return idx > 0 ? name.substring(0, idx) : "— Geral";
}

function fmtCount(n) {
  if (n == null) return "—";
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}

export default function SchemaSidebar({ tables, rowCounts, connectionCounts, selectedTable, onSelectTable }) {
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState({});

  const filteredTables = useMemo(() => {
    if (!search.trim()) return tables;
    const s = search.toLowerCase();
    return tables.filter(t => t.toLowerCase().includes(s));
  }, [tables, search]);

  const hubTables = useMemo(() => {
    return tables
      .map(t => ({ name: t, inCount: connectionCounts[t]?.in || 0 }))
      .filter(t => t.inCount >= 3)
      .sort((a, b) => b.inCount - a.inCount)
      .slice(0, 8);
  }, [tables, connectionCounts]);

  const groups = useMemo(() => {
    const map = {};
    filteredTables.forEach(t => {
      const prefix = getPrefix(t);
      if (!map[prefix]) map[prefix] = [];
      map[prefix].push(t);
    });
    return Object.entries(map).sort((a, b) => {
      if (a[0] === "— Geral") return -1;
      if (b[0] === "— Geral") return 1;
      return b[1].length - a[1].length;
    });
  }, [filteredTables]);

  const toggleGroup = (prefix) => setCollapsed(c => ({ ...c, [prefix]: !c[prefix] }));

  const renderTableRow = (tableName) => {
    const rc = rowCounts[tableName] || 0;
    const cc = connectionCounts[tableName] || { in: 0, out: 0 };
    const isSelected = selectedTable === tableName;
    return (
      <button
        key={tableName}
        onClick={() => onSelectTable(tableName)}
        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left transition-colors ${
          isSelected ? "bg-purple-600/30 text-purple-200 border border-purple-700" : "text-gray-400 hover:bg-gray-800 hover:text-gray-200 border border-transparent"
        }`}
      >
        <Database className="w-3 h-3 shrink-0 text-gray-500" />
        <span className="truncate flex-1">{tableName}</span>
        {cc.in > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] text-amber-500/80" title={`${cc.in} tabelas referenciam esta`}>
            <Star className="w-2.5 h-2.5" />{cc.in}
          </span>
        )}
        <span className={`text-[10px] tabular-nums ${rc > 0 ? "text-gray-500" : "text-gray-700"}`}>
          {fmtCount(rc)}
        </span>
      </button>
    );
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl">
      {/* Search */}
      <div className="p-3 border-b border-gray-800">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-600" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar tabela..."
            className="w-full bg-gray-950 text-gray-200 text-xs rounded pl-8 pr-3 py-2 border border-gray-800 focus:border-purple-500 outline-none"
          />
        </div>
      </div>

      <div className="max-h-[70vh] overflow-y-auto p-2">
        {/* Hub tables (only when no search) */}
        {!search && hubTables.length > 0 && (
          <div className="mb-2 pb-2 border-b border-gray-800">
            <p className="text-[10px] uppercase tracking-wider text-amber-600/80 font-semibold px-2 mb-1 flex items-center gap-1">
              <Star className="w-3 h-3" /> Tabelas Centrais
            </p>
            {hubTables.map(h => renderTableRow(h.name))}
          </div>
        )}

        {/* Grouped tables */}
        {groups.map(([prefix, groupTables]) => {
          const isCollapsed = collapsed[prefix];
          const displayName = MODULE_NAMES[prefix] || prefix;
          return (
            <div key={prefix} className="mb-1">
              <button
                onClick={() => toggleGroup(prefix)}
                className="w-full flex items-center gap-1.5 px-2 py-1 text-[10px] uppercase tracking-wider text-gray-500 hover:text-gray-300 font-semibold"
              >
                {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                <span className="truncate">{displayName}</span>
                <span className="text-gray-700 normal-case tracking-normal">({groupTables.length})</span>
              </button>
              {!isCollapsed && (
                <div className="ml-1 space-y-0.5">
                  {groupTables.map(renderTableRow)}
                </div>
              )}
            </div>
          );
        })}

        {filteredTables.length === 0 && (
          <p className="text-gray-600 text-xs text-center py-4">Nenhuma tabela encontrada</p>
        )}
      </div>
    </div>
  );
}