import { useState, useRef, useEffect } from "react";
import { Settings, GripVertical, Eye, EyeOff, X } from "lucide-react";
import { base44 } from "@/api/base44Client";

function KPI({ label, value, sub, accent }) {
  return (
    <div className={`bg-gray-900 border-l-4 ${accent || "border-red-600"} rounded-lg p-4 h-full`}>
      <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">{label}</p>
      <p className="text-3xl font-bold text-white">{value}</p>
      {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
    </div>
  );
}

function buildItems(cards) {
  return cards.map((_, i) => ({ id: i, visible: true }));
}

export default function KPICardsDraggable({ cards, storageId = "kpi_layout" }) {
  const [items, setItems] = useState(() => buildItems(cards));
  const [loaded, setLoaded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const dragFrom = useRef(null);
  const [dragging, setDragging] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const menuDragFrom = useRef(null);
  const [menuDragOver, setMenuDragOver] = useState(null);
  const saveTimeoutRef = useRef(null);

  // Carregar layout salvo do usuário (apenas uma vez)
  useEffect(() => {
    const loadLayout = async () => {
      try {
        const user = await base44.auth.me();
        const kpis = user?.layoutPreferences?.kpis || {};
        if (kpis[storageId]) {
          setItems(kpis[storageId]);
        }
      } catch (err) {
        console.error("Erro ao carregar KPI layout:", err);
      } finally {
        setLoaded(true);
      }
    };
    
    loadLayout();
  }, [storageId]);

  // Salvar layout com debounce quando items mudar
  useEffect(() => {
    if (!loaded) return;
    
    // Limpar timeout anterior
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Agendar novo salvamento
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        console.log(`Salvando layout KPI ${storageId}:`, items);
        const user = await base44.auth.me();
        const current = user?.layoutPreferences || {};
        await base44.auth.updateMe({
          layoutPreferences: {
            ...current,
            kpis: {
              ...(current.kpis || {}),
              [storageId]: items
            }
          }
        });
        console.log(`Layout KPI ${storageId} salvo com sucesso`);
      } catch (err) {
        console.error(`Erro ao salvar layout KPI ${storageId}:`, err);
      }
    }, 500);
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [items, loaded, storageId]);

  function reorder(arr, from, to) {
    const next = [...arr];
    const [removed] = next.splice(from, 1);
    next.splice(to, 0, removed);
    return next;
  }

  // Grid drag handlers
  const onDragStart = (idx) => { dragFrom.current = idx; setDragging(idx); };
  const onDragEnter = (idx) => setDragOver(idx);
  const onDragEnd = () => {
    const from = dragFrom.current;
    const to = dragOver;
    if (from !== null && to !== null && from !== to) {
      const newItems = reorder(items, from, to);
      setItems(newItems);
    }
    dragFrom.current = null;
    setDragging(null);
    setDragOver(null);
  };

  // Menu drag handlers
  const onMenuDragStart = (idx) => { menuDragFrom.current = idx; };
  const onMenuDragEnter = (idx) => setMenuDragOver(idx);
  const onMenuDragEnd = () => {
    const from = menuDragFrom.current;
    const to = menuDragOver;
    if (from !== null && to !== null && from !== to) {
      const newItems = reorder(items, from, to);
      setItems(newItems);
    }
    menuDragFrom.current = null;
    setMenuDragOver(null);
  };

  const toggleVisible = (idx) => {
    const newItems = items.map((item, i) => i === idx ? { ...item, visible: !item.visible } : item);
    setItems(newItems);
  };

  const reset = () => {
    setItems(buildItems(cards));
  };

  return (
    <div className="relative">
      {/* Settings button */}
      <div className="flex justify-end mb-2">
        <button
          onClick={() => setMenuOpen(v => !v)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-400 hover:text-white text-xs transition-colors"
        >
          <Settings className="w-3.5 h-3.5" />
          Personalizar KPIs
        </button>
      </div>

      {/* Config menu */}
      {menuOpen && (
        <div className="absolute right-0 top-9 z-50 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-72 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-white text-sm font-semibold">Configurar KPI Cards</span>
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
                className={`flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2 cursor-grab transition-opacity ${
                  menuDragOver === listIdx && menuDragFrom.current !== listIdx ? "ring-2 ring-blue-500" : ""
                }`}
              >
                <GripVertical className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                <span className={`flex-1 text-xs ${item.visible ? "text-gray-200" : "text-gray-500 line-through"}`}>
                  {cards[item.id].label}
                </span>
                <button
                  onClick={() => toggleVisible(listIdx)}
                  className="text-gray-500 hover:text-white transition-colors"
                >
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
      )}

      {/* Cards grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {items.map((item, idx) => {
          if (!item.visible) return null;
          const card = cards[item.id];
          return (
            <div
              key={item.id}
              draggable
              onDragStart={() => onDragStart(idx)}
              onDragEnter={() => onDragEnter(idx)}
              onDragEnd={onDragEnd}
              onDragOver={(e) => e.preventDefault()}
              className={`cursor-grab transition-all duration-150 ${
                dragging === idx ? "opacity-40 scale-95" : ""
              } ${dragOver === idx && dragging !== idx ? "ring-2 ring-blue-500 rounded-lg" : ""}`}
            >
              <KPI {...card} />
            </div>
          );
        })}
      </div>
    </div>
  );
}