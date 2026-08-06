import { useState } from "react";
import { DASHBOARD_QUERIES, DASHBOARD_QUERY_GROUPS } from "@/lib/dashboardQueries";
import { Database, ChevronDown, ChevronRight, Terminal } from "lucide-react";

export default function DashboardQueryList({ onLoadQuery }) {
  const [openGroups, setOpenGroups] = useState(() => new Set(DASHBOARD_QUERY_GROUPS));
  const [openSql, setOpenSql] = useState(null);

  const toggleGroup = (g) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      next.has(g) ? next.delete(g) : next.add(g);
      return next;
    });
  };

  const toggleSql = (id) => {
    setOpenSql(prev => (prev === id ? null : id));
  };

  const handleLoad = (sql) => {
    onLoadQuery?.(sql);
    if (window.innerWidth < 1024) {
      document.querySelector('textarea[placeholder*="query"]')?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800 bg-gray-950">
        <Database className="w-4 h-4 text-purple-400" />
        <span className="text-white text-sm font-medium">Queries do Dashboard</span>
        <span className="text-gray-500 text-xs">({DASHBOARD_QUERIES.length})</span>
        <span className="ml-auto text-gray-600 text-xs hidden sm:block">executadas no sync para capturar os dados das abas</span>
      </div>

      <div className="max-h-[600px] overflow-y-auto divide-y divide-gray-800">
        {DASHBOARD_QUERY_GROUPS.map(group => {
          const items = DASHBOARD_QUERIES.filter(q => q.group === group);
          const isOpen = openGroups.has(group);
          return (
            <div key={group}>
              <button
                onClick={() => toggleGroup(group)}
                className="w-full flex items-center gap-2 px-4 py-2.5 bg-gray-900 hover:bg-gray-800/50 transition-colors text-left"
              >
                {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-gray-500" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-500" />}
                <span className="text-gray-300 text-xs font-semibold uppercase tracking-wider">{group}</span>
                <span className="text-gray-600 text-xs ml-auto">{items.length}</span>
              </button>

              {isOpen && items.map(q => {
                const sqlOpen = openSql === q.id;
                return (
                  <div key={q.id} className="px-4 py-2 border-t border-gray-800/50 bg-gray-950/40">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleSql(q.id)}
                        className="flex items-center gap-1.5 text-gray-300 text-sm hover:text-white transition-colors text-left min-w-0"
                      >
                        {sqlOpen ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
                        <span className="truncate">{q.label}</span>
                      </button>
                      <button
                        onClick={() => handleLoad(q.sql)}
                        className="ml-auto flex items-center gap-1 px-2 py-1 text-xs text-purple-400 hover:text-purple-300 hover:bg-purple-950/40 rounded transition-colors shrink-0"
                      >
                        <Terminal className="w-3 h-3" />
                        Usar
                      </button>
                    </div>

                    {sqlOpen && (
                      <pre className="mt-2 text-gray-400 text-xs font-mono whitespace-pre-wrap break-all bg-gray-950 border border-gray-800 rounded-lg p-3 max-h-64 overflow-y-auto">
                        {q.sql}
                      </pre>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}