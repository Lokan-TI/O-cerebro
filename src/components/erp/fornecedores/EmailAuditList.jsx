import { Download } from "lucide-react";
import { fmtDoc } from "@/lib/erpFormat";
import { STATUS } from "./emailAudit";

export default function EmailAuditList({ title, rows, field, onExport }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
        <div className="text-sm text-white font-medium">{title} <span className="text-gray-600">· {rows.length}</span></div>
        <button onClick={onExport} className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300">
          <Download className="w-3.5 h-3.5" /> CSV
        </button>
      </div>
      <div className="max-h-96 overflow-auto">
        <table className="text-sm">
          <thead><tr className="text-gray-500"><th className="text-left">Fornecedor</th><th className="text-left">CNPJ</th><th className="text-left">E-mail</th><th className="text-left">Status</th></tr></thead>
          <tbody>
            {rows.slice(0, 500).map((r) => (
              <tr key={r.cd_pessoa}>
                <td className="text-white text-xs">{r.nm_pessoa}</td>
                <td className="text-gray-400 font-mono text-xs">{fmtDoc(r.cnpj) || "—"}</td>
                <td className="text-gray-300 text-xs break-all">{r[field] || "—"}</td>
                <td className={`text-xs whitespace-nowrap ${STATUS[r.status].cls}`}>{STATUS[r.status].label}{r.erro && <div className="text-[10px] text-gray-500 whitespace-normal">{r.erro}</div>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}