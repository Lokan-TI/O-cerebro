import { useMemo } from "react";
import { MailCheck, Square, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import { onlyDigits, fmtNum, fmtDoc } from "@/lib/erpFormat";
import useEmailAudit from "./useEmailAudit";
import EmailAuditList from "./EmailAuditList";
import { STATUS, validCnpj, classify, downloadCsv } from "./emailAudit";

const RUN_LABEL = { idle: "Não iniciada", running: "Em andamento", done: "Concluída", stopped: "Interrompida" };

export default function SupplierEmailAudit({ suppliers }) {
  const { results, state, progress, run, cancel } = useEmailAudit();

  const rows = useMemo(() => suppliers.map((s) => {
    const cnpj = onlyDigits(s.cnpj || "");
    if (!validCnpj(cnpj)) return { ...s, status: "cnpj_invalido", email_corrigido: "" };
    const res = results[cnpj];
    const status = classify(s, res);
    return { ...s, status, email_corrigido: res?.status === "ok" ? res.email : "", erro: res?.error || "" };
  }), [suppliers, results]);

  const counts = useMemo(() => rows.reduce((c, r) => ({ ...c, [r.status]: (c[r.status] || 0) + 1 }), {}), [rows]);
  const errors = (counts.erro || 0) + (counts.cnpj_invalido || 0) + (counts.nao_encontrado || 0);
  const corrected = rows.filter((r) => r.status === "corrigido" || r.status === "preenchido");

  const exportList = (name, field, list) => downloadCsv(name, ["Código", "Fornecedor", "CNPJ", "E-mail", "Status", "Erro"],
    list.map((r) => [r.cd_pessoa, r.nm_pessoa, r.cnpj, r[field], STATUS[r.status].label, r.erro || ""]));

  const exportXlsx = () => {
    const ws = XLSX.utils.json_to_sheet(corrected.map((r) => ({
      "Código": r.cd_pessoa, "Fornecedor": r.nm_pessoa, "Nome Fantasia": r.nm_fan_pessoa || "", "CNPJ": fmtDoc(r.cnpj),
      "E-mail atual (ERP)": r.email || "", "E-mail encontrado (OpenCNPJ)": r.email_corrigido, "Status": STATUS[r.status].label,
    })));
    ws["!cols"] = [{ wch: 10 }, { wch: 40 }, { wch: 30 }, { wch: 20 }, { wch: 36 }, { wch: 36 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Corrigidos");
    XLSX.writeFile(wb, `fornecedores_emails_corrigidos_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="bg-gray-900/60 border border-purple-800/30 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-white font-medium flex items-center gap-2"><MailCheck className="w-4 h-4 text-purple-400" /> Auditoria de e-mails por CNPJ</div>
          <div className="text-xs text-gray-500">Fonte: OpenCNPJ (dados públicos). Relatório apenas, o cadastro do ERP não é alterado.</div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">Status: <b className="text-white">{RUN_LABEL[state]}</b>{progress.total > 0 && ` · ${fmtNum(progress.done)}/${fmtNum(progress.total)} CNPJs`}</span>
          <button onClick={exportXlsx} disabled={!corrected.length} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-xs text-white font-medium"><FileSpreadsheet className="w-3.5 h-3.5" /> Exportar corrigidos (Excel)</button>
          {state === "running"
            ? <button onClick={cancel} className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 rounded-lg text-xs text-white"><Square className="w-3 h-3" /> Parar</button>
            : <button onClick={() => run(suppliers)} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded-lg text-xs text-white font-medium">{state === "idle" ? "Iniciar auditoria" : "Executar novamente"}</button>}
        </div>
      </div>
      {progress.total > 0 && <div className="h-1 bg-gray-800 rounded"><div className="h-1 bg-purple-500 rounded transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} /></div>}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
        <div className="bg-gray-900 border border-red-800/40 rounded-lg p-2"><div className="text-[10px] text-gray-500 uppercase">Total de erros</div><div className="text-lg font-bold text-red-400">{fmtNum(errors)}</div></div>
        {Object.entries(STATUS).filter(([k]) => k !== "pendente" || counts.pendente).map(([k, s]) => (
          <div key={k} className="bg-gray-900 border border-gray-800 rounded-lg p-2"><div className="text-[10px] text-gray-500 uppercase">{s.label}</div><div className={`text-lg font-bold ${s.cls}`}>{fmtNum(counts[k] || 0)}</div></div>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-3">
        <EmailAuditList title="E-mails atuais (ERP)" rows={rows} field="email" onExport={() => exportList("emails_atuais.csv", "email", rows)} />
        <EmailAuditList title="E-mails corrigidos (OpenCNPJ)" rows={corrected} field="email_corrigido" onExport={() => exportList("emails_corrigidos.csv", "email_corrigido", corrected)} />
      </div>
    </div>
  );
}