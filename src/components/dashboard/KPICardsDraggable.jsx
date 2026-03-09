import { useState, useRef } from "react";
import { Settings, GripVertical, Eye, EyeOff, X } from "lucide-react";

function KPI({ label, value, sub, accent }) {
  return (
    <div className={`bg-gray-900 border-l-4 ${accent || "border-red-600"} rounded-lg p-4 h-full`}>
      <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">{label}</p>
      <p className="text-3xl font-bold text-white">{value}</p>
      {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
    </div>
  );
}

export default function KPICardsDraggable({ cards }) {
  const [order, setOrder] = useState(cards.map((_, i) => i));
  const [visible, setVisible] = useState(cards.map(() => true));
  const [menuOpen, setMenuOpen] = useState(false);
  const [dragging, setDragging] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);

  // Drag & drop handlers (grid)
  const handleDragStart = (e, idx) => {
    dragItem.current = idx;
    setDragging(idx);
  };

  const handleDragEnter = (e, idx) => {
    dragOverItem.current = idx;
    setDragOver(idx);
  };

  const handleDragEnd = () => {
    const from = dragItem.current;
    const to = dragOverItem.current;
    if (from === null || to === null || from === to) {
      setDragging(null);
      setDragOver(null);
      return;
    }
    const newOrder = [...order];
    const [removed] = newOrder.splice(from, 1);
    newOrder.splice(to, 0, removed);
    setOrder(newOrder);
    const newVisible = [...visible];
    const [removedV] = newVisible.splice(from, 1);
    newVisible.splice(to, 0, removedV);
    setVisible(newVisible);
    dragItem.current = null;
    dragOverItem.current = null;
    setDragging(null);
    setDragOver(null);
  };

  // Menu drag & drop handlers
  const menuDragItem = useRef(null);
  const menuDragOver = useRef(null);
  const [menuDragging, setMenuDragging] = useState(null);

  const handleMenuDragStart = (idx) => {
    menuDragItem.current = idx;
    setMenuDragging(idx);
  };

  const handleMenuDragEnter = (idx) => {
    menuDragOver.current = idx;
  };

  const handleMenuDragEnd = () => {
    const from = menuDragItem.current;
    const to = menuDragOver.current;
    if (from === null || to === null || from === to) {
      setMenuDragging(null);
      return;
    }
    const newOrder = [...order];
    const [removed] = newOrder.splice(from, 1);
    newOrder.splice(to, 0, removed);
    setOrder(newOrder);
    const newVisible = [...visible];
    const [removedV] = newVisible.splice(from, 1);
    newVisible.splice(to, 0, removedV);
    setVisible(newVisible);
    menuDragItem.current = null;
    menuDragOver.current = null;
    setMenuDragging(null);
  };

  const toggleVisible = (idx) => {
    const newVisible = [...visible];
    newVisible[idx] = !newVisible[idx];
    setVisible(newVisible);
  };

  const visibleCards = order.filter((_, i) => visible[i]);

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
            {order.map((cardIdx, listIdx) => (
              <div
                key={cardIdx}
                draggable
                onDragStart={() => handleMenuDragStart(listIdx)}
                onDragEnter={() => handleMenuDragEnter(listIdx)}
                onDragEnd={handleMenuDragEnd}
                onDragOver={(e) => e.preventDefault()}
                className={`flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2 cursor-grab transition-opacity ${
                  menuDragging === listIdx ? "opacity-40" : ""
                }`}
              >
                <GripVertical className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                <span className={`flex-1 text-xs ${visible[listIdx] ? "text-gray-200" : "text-gray-500 line-through"}`}>
                  {cards[cardIdx].label}
                </span>
                <button
                  onClick={() => toggleVisible(listIdx)}
                  className="text-gray-500 hover:text-white transition-colors"
                >
                  {visible[listIdx] ? <Eye className="w-3.5 h-3.5 text-blue-400" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => { setOrder(cards.map((_, i) => i)); setVisible(cards.map(() => true)); }}
            className="mt-3 w-full text-xs text-gray-500 hover:text-gray-300 underline text-center"
          >
            Resetar para padrão
          </button>
        </div>
      )}

      {/* Cards grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {order.map((cardIdx, idx) => {
          if (!visible[idx]) return null;
          const card = cards[cardIdx];
          return (
            <div
              key={cardIdx}
              draggable
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragEnter={(e) => handleDragEnter(e, idx)}
              onDragEnd={handleDragEnd}
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