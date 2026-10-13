import { useState } from "react";
import { ChevronDown, ExternalLink, FileSearch } from "lucide-react";
import { RD_FINDINGS, KIND_LABEL } from "./rdAuditFindings";

export default function RdAuditMatrix() {
  const [open, setOpen] = useState(false);
  const counts = RD_FINDINGS.reduce((a, f) => ({ ...a, [f.kind]: (a[f.kind] || 0) + 1 }), {});
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/60">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 p-4 text-left">
        <FileSearch className="h-5 w-5 text-violet-400" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">Auditoria com a documentação oficial RD</p>
          <p className="text-xs text-gray-400">
            {Object.entries(counts).map(([k, n]) => `${n} ${KIND_LABEL[k][0].toLowerCase()}`).join(" · ")}
          </p>
        </div>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="divide-y divide-gray-800 border-t border-gray-800">
          {RD_FINDINGS.map((f) => (
            <div key={f.title} className="grid gap-2 p-4 md:grid-cols-[140px_1fr_auto] md:items-start">
              <div className="text-xs text-gray-500">{f.product} · {f.area}</div>
              <div>
                <p className="text-sm text-white">{f.title}</p>
                <p className="text-xs text-gray-400">{f.detail}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-2 py-0.5 text-[11px] ${KIND_LABEL[f.kind][1]}`}>{KIND_LABEL[f.kind][0]}</span>
                <a href={f.doc} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-violet-300"><ExternalLink className="h-3.5 w-3.5" /></a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}