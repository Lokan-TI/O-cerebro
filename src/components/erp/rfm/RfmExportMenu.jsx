import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { buildRows, toExcel, toPdf } from "./rfmExport";

export default function RfmExportMenu({ list, orcLoc, periods, title }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const run = async (fmt) => {
    setBusy(true); setErr(null);
    try {
      const rows = await buildRows(list, orcLoc, periods);
      const name = title.replace(/[^\w-]+/g, "_");
      fmt === "pdf" ? toPdf(rows, name) : toExcel(rows, name);
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  return (
    <div className="flex items-center gap-2">
      {err && <span className="text-xs text-red-400">{err}</span>}
      <DropdownMenu>
        <DropdownMenuTrigger disabled={busy || !list.length} className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-medium rounded-md px-3 py-1.5">
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Baixar
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => run("xlsx")}>Excel</DropdownMenuItem>
          <DropdownMenuItem onClick={() => run("pdf")}>PDF</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}