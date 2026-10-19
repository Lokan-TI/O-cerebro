import { useMemo, useState } from "react";
import { ShieldCheck, Square, FileSpreadsheet, RefreshCw } from "lucide-react";
import { useErpSource, ALL_SOURCES_ID } from "@/lib/ErpSourceContext";
import { fmtNum } from "@/lib/erpFormat";
import useCnpjCorrection from "@/components/erp/cadastro/useCnpjCorrection";
import CnpjDiffTable from "@/components/erp/cadastro/CnpjDiffTable";
import CnpjRunCompare from "@/components/erp/cadastro/CnpjRunCompare";
import { STATUS, GROUPS, exportChanges } from "@/components/erp/cadastro/cnpjDiff";

const TIPOS = [{ id: "cliente", label: "Cliente", dot: "bg-green-500" }, { id: "fornecedor", label: "Fornecedor", dot: "bg-blue-500" }];

export default function TabCorrecaoCadastral() {
  const { selectedSource } = useErpSource();
  const sourceKey = selectedSource?.id && selectedSource.id !== ALL_SOURCES_ID ? selectedSource.id : "all";
  const c = useCnpjCorrection(sourceKey);
  const [tipos, setTipos] = useState(["cliente", "fornecedor"]);
  const [groups, setGroups] = useState(new Set(Object.keys(GROUPS)));
  const results = useMemo(() => Object.values(c.results), [c.results]);
  const counts = useMemo(() => results.reduce((m, r) => ({ ...m, [r.status]: (m[r.status] || 0) + 1 }), {}), [results]);
  const toggle = (id) => setTipos((t) => t.includes(id) ? t.filter((x) => x !== id) : [...t, id]);
  const toggleGroup = (g) => setGroups((s) => { const n = new Set(s); n.has(g) ? n.delete(g) : n.add(g); return n; });
  const busy = c.state === "loading" || c.state === "running";

  return (
    <div className="space-y-4">
      <div className="bg-gray-900/60 border border-purple-800/30 rounded-xl p-4 space-y-3">
        <div className="text-white font-medium flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-purple-400" /> Correção cadastral por CNPJ (tabela PESSOA)</div>
        <div className="text-xs text-gray-500">Fonte: base pública processada pelo OpenCNPJ a partir dos dados abertos da Receita Federal (alternativa BrasilAPI). Não é consulta oficial em tempo real. O ERP nunca é alterado: a planilha serve para revisão e aplicação manual.</div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-400 mr-1">Tipo pessoa</span>
          {TIPOS.map((t) => (
            <button key={t.id} onClick={() => toggle(t.id)} disabled={busy} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border transition ${tipos.includes(t.id) ? "border-amber-400/70 bg-amber-400/10 text-white" : "border-gray-800 text-gray-400"}`}>
              <span className={`w-3 h-3 rounded-sm ${t.dot}`} />{t.label}
            </button>
          ))}
          <button onClick={() => c.load(tipos)} disabled={busy || !tipos.length} className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-lg text-xs text-white font-medium">
            <RefreshCw className={`w-3.5 h-3.5 ${c.state === "loading" ? "animate-spin" : ""}`} /> Carregar do ERP
          </button>
          {c.people && <span className="text-xs text-gray-500">{fmtNum(c.people.length)} cadastros com CNPJ</span>}
        </div>
        {c.error && <div className="text-sm text-red-300 bg-red-950/40 border border-red-800/50 rounded-lg px-3 py-2">{c.error}</div>}
        {c.people && (
          <div className="flex flex-wrap items-center gap-2">
            {c.state === "running"
              ? <button onClick={c.cancel} className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 rounded-lg text-xs text-white"><Square className="w-3 h-3" /> Parar</button>
              : <button onClick={() => c.run(tipos)} disabled={busy} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded-lg text-xs text-white font-medium">{results.length ? "Consultar novamente" : "Consultar CNPJs"}</button>}
            {!busy && counts.error > 0 && <button onClick={() => c.run(tipos, true)} className="px-3 py-1.5 bg-red-800 hover:bg-red-700 rounded-lg text-xs text-white">Repetir {counts.error} falhas</button>}
            <button onClick={() => exportChanges(results, groups)} disabled={!counts.divergente} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 rounded-lg text-xs text-white font-medium"><FileSpreadsheet className="w-3.5 h-3.5" /> Exportar alterações (Excel)</button>
            {c.progress.total > 0 && <span className="text-xs text-gray-400">{fmtNum(c.progress.done)}/{fmtNum(c.progress.total)} CNPJs · {c.state === "running" ? "em andamento" : c.state === "stopped" ? "interrompida" : "concluída"}</span>}
          </div>
        )}
        {c.progress.total > 0 && <div className="h-1 bg-gray-800 rounded"><div className="h-1 bg-purple-500 rounded transition-all" style={{ width: `${(c.progress.done / c.progress.total) * 100}%` }} /></div>}
        {results.length > 0 && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {Object.entries(STATUS).map(([k, s]) => <div key={k} className="bg-gray-900 border border-gray-800 rounded-lg p-2"><div className="text-[10px] text-gray-500 uppercase">{s.label}</div><div className={`text-lg font-bold ${s.cls}`}>{fmtNum(counts[k] || 0)}</div></div>)}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">Campos incluídos:
              {Object.entries(GROUPS).map(([g, l]) => <label key={g} className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" className="accent-purple-600" checked={groups.has(g)} onChange={() => toggleGroup(g)} />{l}</label>)}
            </div>
          </>
        )}
      </div>
      {results.length > 0 && <CnpjDiffTable results={results} groups={groups} />}
      <CnpjRunCompare refreshKey={c.savedTick} />
    </div>
  );
}