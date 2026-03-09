import { useState, useRef, useEffect } from "react";
import { Settings, GripVertical, Eye, EyeOff, X } from "lucide-react";
import { base44 } from "@/api/base44Client";

function buildItems(sections) {
  return sections.map((_, i) => ({ id: i, visible: true }));
}

export default function SectionsDraggable({ sections }) {
  const storageKey = "sections_layout_google";
  const [items, setItems] = useState(() => buildItems(sections));
  const [isSynced, setIsSynced] = useState(false);
  
  const [menuOpen, setMenuOpen] = useState(false);
  const [dragging, setDragging] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const dragFrom = useRef(null);
  const menuDragFrom = useRef(null);
  const [menuDragOver, setMenuDragOver] = useState(null);

  // Carregar layout salvo do usuário
  useEffect(() => {
    const loadLayout = async () => {
      try {
        const user = await base44.auth.me();
        if (user?.sectionsLayout_google) {
          setItems(user.sectionsLayout_google);
        }
        setIsSynced(true);
      } catch {
        // Se falhar, tenta localStorage
        try {
          const saved = localStorage.getItem(storageKey);
          if (saved) setItems(JSON.parse(saved));
        } catch {}
        setIsSynced(true);
      }
    };
    loadLayout();
  }, []);

  // Salvar layout sempre que mudar
  const saveLayout = async (newItems) => {
    try {
      await base44.auth.updateMe({ sectionsLayout_google: newItems });
    } catch {
      // Fallback para localStorage
      localStorage.setItem(storageKey, JSON.stringify(newItems));
    }
  };

  function reorder(arr, from, to) {
    const next = [...arr];
    const [removed] = next.splice(from, 1);
    next.splice(to, 0, removed);
    return next;
  }

  const onDragStart = (idx) => { dragFrom.current = idx; setDragging(idx); };
  const onDragEnter = (idx) => setDragOver(idx);
  const onDragEnd = () => {
    const from = dragFrom.current;
    const to = dragOver;
    if (from !== null && to !== null && from !== to) {
      const newItems = reorder(items, from, to);
      setItems(newItems);
      saveLayout(newItems);
    }
    dragFrom.current = null;
    setDragging(null);
    setDragOver(null);
  };

  const onMenuDragStart = (idx) => { menuDragFrom.current = idx; };
  const onMenuDragEnter = (idx) => setMenuDragOver(idx);
  const onMenuDragEnd = () => {
    const from = menuDragFrom.current;
    const to = menuDragOver;
    if (from !== null && to !== null && from !== to) {
      const newItems = reorder(items, from, to);
      setItems(newItems);
      saveLayout(newItems);
    }
    menuDragFrom.current = null;
    setMenuDragOver(null);
  };

  const toggleVisible = (idx) => {
    const newItems = items.map((item, i) => i === idx ? { ...item, visible: !item.visible } : item);
    setItems(newItems);
    saveLayout(newItems);
  };

  const reset = () => {
    const defaultItems = buildItems(sections);
    setItems(defaultItems);
    saveLayout(defaultItems);
  };

  return (
    <div className="space-y-6">
      {/* Settings button */}
      <div className="flex justify-end -mb-3">
        <button
          onClick={() => setMenuOpen(v => !v)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-400 hover:text-white text-xs transition-colors"
        >
          <Settings className="w-3.5 h-3.5" />
          Personalizar Seções
        </button>
      </div>

      {/* Config menu */}
      {menuOpen && (
        <div className="relative">
          <div className="absolute right-0 -top-2 z-50 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-72 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-white text-sm font-semibold">Configurar Seções</span>
              <button onClick={() => setMenuOpen(false)} className="text-gray-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-gray-500 text-xs mb-3">Arraste para reordenar · clique no olho para ocultar</p>
            <div className="space-y-1.5">
              {items.map((item, listIdx) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => onMenuDragStart(listIdx)}
                  onDragEnter={() => onMenuDragEnter(listIdx)}
                  onDragEnd={onMenuDragEnd}
                  onDragOver={(e) => e.preventDefault()}
                  className={`flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2 cursor-grab transition-all ${
                    menuDragOver === listIdx && menuDragFrom.current !== listIdx ? "ring-2 ring-blue-500" : ""
                  }`}
                >
                  <GripVertical className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                  <span className={`flex-1 text-xs ${item.visible ? "text-gray-200" : "text-gray-500 line-through"}`}>
                    {sections[item.id].label}
                  </span>
                  <button onClick={() => toggleVisible(listIdx)} className="text-gray-500 hover:text-white transition-colors">
                    {item.visible
                      ? <Eye className="w-3.5 h-3.5 text-blue-400" />
                      : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={reset}
              className="mt-3 w-full text-xs text-gray-500 hover:text-gray-300 underline text-center"
            >
              Resetar para padrão
            </button>
          </div>
        </div>
      )}

      {/* Sections */}
      {items.map((item, idx) => {
        if (!item.visible) return null;
        const section = sections[item.id];
        return (
          <div
            key={item.id}
            draggable
            onDragStart={() => onDragStart(idx)}
            onDragEnter={() => onDragEnter(idx)}
            onDragEnd={onDragEnd}
            onDragOver={(e) => e.preventDefault()}
            className={`transition-all duration-150 ${
              dragging === idx ? "opacity-40 scale-[0.99]" : ""
            } ${dragOver === idx && dragging !== idx ? "ring-2 ring-blue-500 rounded-xl" : ""}`}
          >
            {/* Drag handle bar */}
            <div className="flex items-center gap-2 mb-1 cursor-grab select-none opacity-0 hover:opacity-100 transition-opacity group-hover:opacity-100">
              <GripVertical className="w-4 h-4 text-gray-600" />
              <span className="text-gray-600 text-xs">{section.label}</span>
            </div>
            {section.content}
          </div>
        );
      })}
    </div>
  );
}