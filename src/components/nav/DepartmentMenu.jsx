import { useState } from "react";
import { Link } from "react-router-dom";
import { DEPARTMENTS } from "@/lib/departmentsMenu";
import { Menu, X } from "lucide-react";
import SourceSelector from "./SourceSelector";
import ApiConnectionsNav from "./ApiConnectionsNav";

export default function DepartmentMenu() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Abrir menu de dados"
        className="fixed top-4 right-5 z-40 w-10 h-10 rounded-xl bg-gray-900/80 backdrop-blur border border-gray-800 hover:border-purple-600/60 flex items-center justify-center text-purple-400 transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="relative w-80 max-w-[85vw] h-full bg-gray-950 border-l border-gray-800 overflow-y-auto">
            <div className="sticky top-0 bg-gray-950 flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <div>
                <p className="text-white font-semibold text-sm">Dados por departamento</p>
                <p className="text-gray-600 text-xs">Sales Analytics</p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Fechar menu" className="text-gray-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <SourceSelector />
            <div className="mx-5 my-4 border-t border-gray-800" />

            <nav className="px-3 pb-4 space-y-5">
              <ApiConnectionsNav onNavigate={() => setOpen(false)} />
              {DEPARTMENTS.map((d) => (
                <div key={d.id}>
                  <p className="px-2 text-[10px] uppercase tracking-widest text-purple-500/80 mb-1.5">{d.label}</p>
                  <div className="space-y-0.5">
                    {d.items.map((item) =>
                      item.soon ? (
                        <span key={item.label} className="flex items-center justify-between px-3 py-2 rounded-lg text-sm text-gray-600">
                          {item.label}
                          <span className="text-[10px] text-gray-700 border border-gray-800 rounded px-1.5 py-0.5">em breve</span>
                        </span>
                      ) : (
                        <Link
                          key={item.label}
                          to={item.to}
                          onClick={() => setOpen(false)}
                          className="block px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-900 transition-colors"
                        >
                          {item.label}
                        </Link>
                      )
                    )}
                  </div>
                </div>
              ))}
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}