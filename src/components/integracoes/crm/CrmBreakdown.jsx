const brl = (v) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

// Tabela compacta: quantidade e valor por dimensão.
export default function CrmBreakdown({ title, rows, field, labels = {} }) {
  const total = rows.reduce((a, r) => a + (r.count || 0), 0) || 1;
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900/40 p-5">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">{title}</p>
      {!rows.length && <p className="text-xs text-gray-500">Sem negociações no período.</p>}
      <div className="space-y-2.5">
        {rows.slice(0, 12).map((r) => (
          <div key={r[field] ?? "—"}>
            <div className="flex justify-between gap-3 text-xs">
              <span className="truncate text-gray-200">{labels[r[field]] || r[field] || "Não informado"}</span>
              <span className="shrink-0 text-gray-400">{r.count} · {brl(r.sum_amount)}</span>
            </div>
            <div className="mt-1 h-1 rounded-full bg-gray-800">
              <div className="h-1 rounded-full bg-violet-500/70 transition-all duration-500" style={{ width: `${(r.count / total) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}