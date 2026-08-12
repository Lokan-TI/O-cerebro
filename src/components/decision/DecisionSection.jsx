import DecisionCard from "./DecisionCard";

export default function DecisionSection({ dept, editing, hiddenIds, onToggle }) {
  const visible = dept.kpis.filter((k) => editing || !hiddenIds.includes(`${dept.id}.${k.id}`));
  if (!visible.length) return null;

  return (
    <section className="mb-8">
      <h2 className="text-sm font-semibold text-purple-400 uppercase tracking-wider mb-3">{dept.label}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {visible.map((k) => {
          const key = `${dept.id}.${k.id}`;
          return (
            <DecisionCard
              key={key}
              kpi={k}
              editing={editing}
              hidden={hiddenIds.includes(key)}
              onToggle={() => onToggle(key)}
            />
          );
        })}
      </div>
    </section>
  );
}