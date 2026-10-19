import { useEffect, useMemo, useState } from "react";
import { GitCompare, Download, Loader2 } from "lucide-react";
import { fmtNum, fmtDoc } from "@/lib/erpFormat";
import { STATUS, downloadCsv } from "./emailAudit";
import { DIFF, listRuns, loadRunResults, compareRuns } from "./auditHistory";
import AuditCompareDetail from "./AuditCompareDetail";

const runLabel = (r) => `${new Date(r.started_at).toLocaleString("pt-BR")} · ${fmtNum(r.total)} CNPJs${r.status === "stopped" ? " (interrompida)" : ""}`;

export default function AuditRunCompare({ refreshKey }) {
  const [runs, setRuns] = useState(null);
  const [ids, setIds] = useState({ a: "", b: "" });
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(false);
  const [kind, setKind] = useState("todos");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);

  useEffect(() => {
    listRuns().then((rs) => {
      setRuns(rs);
      if (rs.length >= 2) setIds({ a: rs[rs.length - 1].id, b: rs[0].id });
    });
  }, [refreshKey]);

  useEffect(() => {
    if (!ids.a || !ids.b || ids.a === ids.b) { setItems(null); return; }
    setLoading(true);
    Promise.all([loadRunResults(ids.a), loadRunResults(ids.b)])
      .then(([a, b]) => setItems(compareRuns(a, b))).finally(() => setLoading(false));
  }, [ids.a, ids.b]);

  const counts = useMemo(() => (items || []).reduce((c, i) => ({ ...c, [i.kind]: (c[i.kind] || 0) + 1 }), {}), [items]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (items || []).filter((i) => (kind === "todos" ? i.kind !== "igual" : i.kind === kind)
      && (!t || i.cnpj.includes(t.replace(/\D/g, "") || "§") || (i.nm_pessoa || "").toLowerCase().includes(t)));
  }, [items, kind, q]);

  const exportCsv = () => downloadCsv("comparacao_auditorias.csv",
    ["Código", "Fornecedor", "CNPJ", "Diferença", "Status base", "E-mail base", "Status comparada", "E-mail comparada", "E-mail ERP", "Erro"],
    shown.map((i) => [i.cd_pessoa, i.nm_pessoa, i.cnpj, DIFF[i.kind].label, STATUS[i.a?.status]?.label || "-", i.a?.found_email || "",
      STATUS[i.b?.status]?.label || "-", i.b?.found_email || "", (i.b || i.a).erp_email, i.b?.error || ""]));

  const sel = (k) => (
    <select value={ids[k]} onChange={(e) => setIds({ ...ids, [k]: e.target.value })} className="bg-gray-900 border border-gray-800 rounded-md px-2 py-1.5 text-xs text-white">
      <option value="">Selecione…</option>
      {runs.map((r) => <option key={r.id} value={r.id}>{runLabel(r)}</option>)}
    </select>
  );

  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 space-y-3">
      <div className="text-white font-medium flex items-center gap-2"><GitCompare className="w-4 h-4 text-purple-400" /> Comparar execuções da auditoria</div>
      {!runs ? <Loader2 className="w-4 h-4 animate-spin text-gray-500" /> : runs.length < 2 ? (
        <div className="text-xs text-amber-300/90 bg-amber-900/10 border border-amber-800/30 rounded-lg p-3">
          A primeira execução não foi salva no histórico, então a comparação retroativa não é possível. A partir de agora cada execução é registrada
          ({fmtNum(runs.length)} salva até aqui); com duas execuções a comparação fica disponível.
        </div>
      ) : (<>
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">Base {sel("a")} Comparada {sel("b")}</div>
        {loading ? <Loader2 className="w-4 h-4 animate-spin text-gray-500" /> : items && (<>
          <div className="flex flex-wrap gap-2">
            {Object.entries(DIFF).map(([k, d]) => (
              <button key={k} onClick={() => setKind(kind === k ? "todos" : k)} className={`px-2.5 py-1.5 rounded-lg border text-left ${kind === k ? "border-purple-500 bg-purple-900/20" : "border-gray-800 bg-gray-900"}`}>
                <div className="text-[10px] text-gray-500 uppercase">{d.label}</div><div className={`text-base font-bold ${d.cls}`}>{fmtNum(counts[k] || 0)}</div>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por CNPJ ou nome" className="flex-1 bg-gray-900 border border-gray-800 rounded-md px-2.5 py-1.5 text-xs text-white" />
            <button onClick={exportCsv} disabled={!shown.length} className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 rounded-lg text-xs text-white"><Download className="w-3.5 h-3.5" /> CSV</button>
          </div>
          <div className="max-h-96 overflow-y-auto space-y-1">
            {shown.slice(0, 300).map((i) => (
              <div key={i.cnpj}>
                <button onClick={() => setOpen(open === i.cnpj ? null : i.cnpj)} className="w-full flex justify-between gap-2 px-3 py-2 text-xs bg-gray-950 hover:bg-gray-900 rounded-md text-left">
                  <span className="text-white truncate">{i.nm_pessoa} <span className="text-gray-500">{fmtDoc(i.cnpj)}</span></span>
                  <span className={DIFF[i.kind].cls}>{DIFF[i.kind].label}</span>
                </button>
                {open === i.cnpj && <AuditCompareDetail item={i} />}
              </div>
            ))}
            {!shown.length && <div className="text-xs text-gray-500 p-2">Nenhuma diferença nesta categoria.</div>}
          </div>
        </>)}
      </>)}
    </div>
  );
}