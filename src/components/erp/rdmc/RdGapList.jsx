import { useState } from "react";

export default function RdGapList({ title, data, groupKey, groupLabel }) {
  const [open, setOpen] = useState(false);
  const groups = data?.[groupKey] || [];
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-medium text-gray-300">{title}</p>
        <span className="text-2xl font-bold text-amber-300">{data?.count ?? 0}</span>
      </div>
      <p className="mt-3 text-[11px] uppercase tracking-wide text-gray-500">{groupLabel} ({groups.length})</p>
      <ul className="mt-1 max-h-48 space-y-1 overflow-y-auto pr-1">
        {groups.map((g) => <li key={g.name} className="flex justify-between gap-2 text-xs text-gray-300"><span className="truncate">{g.name}</span><b className="text-white">{g.count}</b></li>)}
      </ul>
      {data?.deals?.length > 0 && <button onClick={() => setOpen(!open)} className="mt-3 text-xs text-purple-400 hover:text-purple-300">{open ? "Ocultar negociações" : "Ver negociações"}</button>}
      {open && <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto pr-1">
        {data.deals.map((x) => <li key={x.deal_id} className="rounded border border-gray-800 p-2 text-[11px] text-gray-400">
          <p className="text-gray-200">{x.name}</p>
          <p>{x.company} · {x.owner}{x.proposal ? ` · proposta ${x.proposal}` : ""} · {String(x.created_at || "").slice(0, 10).split("-").reverse().join("/")}</p>
        </li>)}
      </ul>}
    </div>
  );
}