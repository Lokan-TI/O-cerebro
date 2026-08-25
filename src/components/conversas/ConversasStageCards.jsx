import { STAGES } from "./conversasStages";

export default function ConversasStageCards({ byStage, selected, onSelect, total }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <button
        onClick={() => onSelect(null)}
        className={`text-left bg-gray-900 border rounded-xl p-4 ${selected == null ? "border-white" : "border-gray-800"}`}
      >
        <p className="text-xs text-gray-400">Todos os leads que entraram em contato</p>
        <p className="text-2xl font-semibold text-white mt-1">{total}</p>
      </button>
      {STAGES.map((s) => (
        <button
          key={s.id}
          onClick={() => onSelect(s.id)}
          className={`text-left bg-gray-900 border rounded-xl p-4 ${selected === s.id ? "border-white" : "border-gray-800"}`}
        >
          <p className="text-xs text-gray-400 leading-snug">{s.label}</p>
          <p className={`text-2xl font-semibold mt-1 ${s.color}`}>{byStage?.[s.id] || 0}</p>
        </button>
      ))}
    </div>
  );
}