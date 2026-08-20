import { useState } from "react";
import { REPORT_FORMATS, exportReport } from "@/lib/reportExport";
import { FileDown, Loader2 } from "lucide-react";

export default function BrainReportDownload({ rows, question, answer }) {
  const [busy, setBusy] = useState("");
  if (!rows?.length) return null;

  const run = async (format) => {
    setBusy(format);
    try {
      await exportReport({ format, rows, question, answer });
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="not-prose mt-2 pt-2 border-t border-gray-800">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="flex items-center gap-1.5 text-[11px] text-gray-500">
          <FileDown className="w-3 h-3 text-purple-500" /> Baixar relatório ({rows.length} linhas):
        </span>
        {REPORT_FORMATS.map((f) => (
          <button
            key={f.id}
            onClick={() => run(f.id)}
            disabled={!!busy}
            className="flex items-center gap-1 px-2 py-0.5 rounded-md border border-gray-700 hover:border-purple-500 text-[11px] text-gray-300 hover:text-purple-300 disabled:opacity-40 transition-colors"
          >
            {busy === f.id && <Loader2 className="w-2.5 h-2.5 animate-spin" />} {f.label}
          </button>
        ))}
      </div>
    </div>
  );
}