import { fmtDoc } from "@/lib/erpFormat";
import { STATUS } from "./emailAudit";
import { DIFF } from "./auditHistory";

function Side({ title, r }) {
  if (!r) return <div className="flex-1 bg-gray-950 rounded-lg p-3 text-xs text-gray-500">{title}: não auditado</div>;
  return (
    <div className="flex-1 bg-gray-950 rounded-lg p-3 text-xs space-y-1">
      <div className="text-gray-500 uppercase text-[10px]">{title}</div>
      <div>Status: <b className={STATUS[r.status]?.cls}>{STATUS[r.status]?.label || r.status}</b></div>
      <div className="text-gray-400">ERP: <span className="text-white">{r.erp_email || "(vazio)"}</span></div>
      <div className="text-gray-400">Fonte pública: <span className="text-white">{r.found_email || "(vazio)"}</span></div>
      {r.error && <div className="text-red-400">Erro: {r.error}</div>}
    </div>
  );
}

export default function AuditCompareDetail({ item }) {
  return (
    <div className="space-y-2 p-3 bg-gray-900 border border-gray-800 rounded-lg">
      <div className="text-sm text-white">{item.nm_pessoa} · <span className="text-gray-400">{fmtDoc(item.cnpj)}</span></div>
      <div className="text-xs text-gray-400">{DIFF[item.kind].why}</div>
      <div className="flex flex-col md:flex-row gap-2"><Side title="Execução base" r={item.a} /><Side title="Execução comparada" r={item.b} /></div>
    </div>
  );
}