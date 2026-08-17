// Seletor de colunas agrupado (tabela base + relacionadas) para a exportação CAP/CAR.
export default function ExportColumnPicker({ catalog, selected, onToggle, onSetGroup }) {
  if (!catalog) return null;
  const groups = [
    { key: "base", label: "Colunas da tabela", cols: catalog.base },
    { key: "related", label: "Colunas relacionadas (cliente/credor, empresa, conta, cobrança)", cols: catalog.related },
  ];
  return (
    <div className="space-y-4">
      {groups.map((g) => {
        const ids = g.cols.map((c) => c.id);
        const allOn = ids.every((id) => selected.has(id));
        return (
          <div key={g.key} className="bg-gray-950/50 border border-gray-800 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400 uppercase tracking-wide">{g.label} · {ids.filter((id) => selected.has(id)).length}/{ids.length}</span>
              <button
                onClick={() => onSetGroup(ids, !allOn)}
                className="text-xs text-purple-400 hover:text-purple-300"
              >
                {allOn ? "Desmarcar todas" : "Marcar todas"}
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1 max-h-56 overflow-y-auto pr-1">
              {g.cols.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer hover:text-white py-0.5">
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    onChange={() => onToggle(c.id)}
                    className="accent-purple-600"
                  />
                  <span className="truncate" title={`${c.label} (${c.id})`}>{c.label}</span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}