import DecisionCard from "./DecisionCard";

function Grid({ deptId, kpis, editing, hiddenIds, onToggle }) {
  const visible = kpis.filter((k) => editing || !hiddenIds.includes(`${deptId}.${k.id}`));
  if (!visible.length) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {visible.map((k) => {
        const key = `${deptId}.${k.id}`;
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
  );
}

export default function DecisionSection({ dept, editing, hiddenIds, onToggle }) {
  return (
    <section className="mb-8">
      <h2 className="text-sm font-semibold text-purple-400 uppercase tracking-wider mb-3">{dept.label}</h2>
      {dept.groups ? (
        <div className="space-y-5">
          {dept.groups.map((g) => (
            <div key={g.label}>
              <p className="text-xs text-gray-500 mb-2">{g.label}</p>
              <Grid deptId={dept.id} kpis={g.kpis} editing={editing} hiddenIds={hiddenIds} onToggle={onToggle} />
            </div>
          ))}
        </div>
      ) : (
        <Grid deptId={dept.id} kpis={dept.kpis} editing={editing} hiddenIds={hiddenIds} onToggle={onToggle} />
      )}
    </section>
  );
}