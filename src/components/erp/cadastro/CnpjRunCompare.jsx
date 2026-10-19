import { useEffect, useMemo, useState } from "react";
import { History, Download } from "lucide-react";
import { fmtDoc } from "@/lib/erpFormat";
import { listRuns, runResults, compareRuns, CMP } from "./cnpjRuns";
import { downloadCsv } from "@/components/erp/fornecedores/emailAudit";

const label = (r) => `${new Date(r.started_at).toLocaleString("pt-BR")} · ${(r.tipos || []).join("+")} · ${r.total} cad.`;

export default function CnpjRunCompare({ refreshKey }) {
  const [runs, setRuns] = useState([]);
  const [a, setA] = useState(""); const [b, setB] = useState("");
  const [diff, setDiff] = useState(null);
  const [kind, setKind] = useState("all"); const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { listRuns().then((r) => { setRuns(r); setB(r[0]?.id || ""); setA(r[1]?.id || ""); }); }, [refreshKey]);
  useEffect(() => {
    if (!a || !b || a === b) { setDiff(null); return; }
    setLoading(true);
    Promise.all([runResults(a), runResults(b)]).then(([x, y]) => setDiff(compareRuns(x, y))).finally(() => setLoading(false));
  }, [a, b]);

  const counts = useMemo(() => (diff || []).reduce((c, d) => ({ ...c, [d.kind]: (c[d.kind] || 0) + 1 }), {}), [diff]);
  const list = useMemo(() => (diff || []).filter((d) => (kind === "all" || d.kind === kind)
    && (!q || d.row.nm_pessoa?.toLowerCase().includes(q.toLowerCase()) || d.row.cnpj.includes(q.replace(/\D/g, "") || "#"))), [diff, kind, q]);
  const exp = () => downloadCsv("comparacao_correcao_cnpj.csv", ["CNPJ", "Código", "Nome", "Campo", "Resultado", "Sugerido (anterior)", "Sugerido (atual)", "ERP (atual)"],
    list.map((d) => [d.row.cnpj, d.row.cd_pessoa, d.row.nm_pessoa, d.label, CMP[d.kind].label, d.before?.suggested || "", d.after?.suggested || "", (d.after || d.before)?.erp || ""]));
  const sel = (v, set) => <select value={v} onChange={(e) => set(e.target.value)} className="bg-gray-950 border border-gray-800 rounded-lg text-xs text-white px-2 py-1.5 max-w-xs">{runs.map((r) => <option key={r.id} value={r.id}>{label(r)}</option>)}</select>;

  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 space-y-3">
      <div className="text-white font-medium flex items-center gap-2"><History className="w-4 h-4 text-purple-400" /> Histórico e comparação de execuções</div>
      {runs.length < 2 ? <div className="text-xs text-gray-500">{runs.length ? "Apenas uma execução salva. Execute novamente para comparar." : "Nenhuma execução salva ainda."}</div> : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">Anterior {sel(a, setA)} Atual {sel(b, setB)}</div>
          {loading && <div className="text-xs text-gray-500">Comparando…</div>}
          {diff && (
            <>
              <div className="flex flex-wrap gap-2">
                {[["all", "Todas", "text-white"], ...Object.entries(CMP).map(([k, c]) => [k, c.label, c.cls])].map(([k, l, cls]) => (
                  <button key={k} onClick={() => setKind(k)} className={`px-2.5 py-1 rounded-lg text-xs border ${kind === k ? "border-purple-500 bg-purple-900/30" : "border-gray-800"} ${cls}`}>{l} ({k === "all" ? diff.length : counts[k] || 0})</button>
                ))}
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome ou CNPJ…" className="px-2 py-1 bg-gray-950 border border-gray-800 rounded-lg text-xs text-white" />
                <button onClick={exp} className="flex items-center gap-1 px-2.5 py-1 bg-gray-800 rounded-lg text-xs text-white"><Download className="w-3 h-3" /> CSV</button>
              </div>
              <div className="max-h-80 overflow-auto">
                <table className="text-xs">
                  <thead><tr><th className="text-left">Cadastro</th><th className="text-left">Campo</th><th className="text-left">Resultado</th><th className="text-left">Anterior</th><th className="text-left">Atual</th></tr></thead>
                  <tbody>{list.slice(0, 300).map((d) => (
                    <tr key={d.key}><td><div className="text-white">{d.row.nm_pessoa}</div><div className="text-gray-500 font-mono">{fmtDoc(d.row.cnpj)}</div></td>
                      <td className="text-gray-400">{d.label}</td><td className={CMP[d.kind].cls}>{CMP[d.kind].label}</td>
                      <td className="text-gray-300">{d.before?.suggested || "—"}</td><td className="text-gray-300">{d.after?.suggested || "—"}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}