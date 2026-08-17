import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useErpSource, ALL_SOURCES_ID } from "@/lib/ErpSourceContext";
import TotvsSummaryCards from "@/components/erp/TotvsSummaryCards";
import TotvsPreviewTable from "@/components/erp/TotvsPreviewTable";
import { downloadTotvsCsv } from "@/components/erp/totvsCsv";
import { Download, Search, Loader2, AlertTriangle, ArrowRightLeft } from "lucide-react";

const PAGE_SIZE = 5000;

// Status disponíveis por documento (domínio oficial do Sisloc).
const STATUS_OPTIONS = {
  car: [
    { id: "aberto_vencido", label: "Aberto (vencido)" },
    { id: "aberto_a_vencer", label: "Aberto (a vencer)" },
  ],
  cap: [
    { id: "aberto_a_vencer", label: "Aberto (a vencer)" },
    { id: "provisorio", label: "Provisório" },
  ],
};

export default function TotvsSaneamentoTab() {
  const { selectedSource } = useErpSource();
  const sourceId = selectedSource && selectedSource.id !== ALL_SOURCES_ID ? selectedSource.id : undefined;

  const [doc, setDoc] = useState("car");
  const [start, setStart] = useState("2013-01-01");
  const [end, setEnd] = useState(new Date().toISOString().slice(0, 10));
  const [statuses, setStatuses] = useState(STATUS_OPTIONS.car.map((s) => s.id));
  const [layout, setLayout] = useState(null);
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState(null);
  const [phase, setPhase] = useState("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    base44.functions.invoke("exportTotvs", { mode: "layout", doc }).then((res) => {
      if (alive && res?.data?.success) setLayout(res.data.columns);
    }).catch(() => {});
    setStatuses(STATUS_OPTIONS[doc].map((s) => s.id));
    setSummary(null);
    setRows(null);
    setError(null);
  }, [doc]);

  const toggleStatus = (id) => {
    setStatuses((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);
    setSummary(null);
    setRows(null);
  };

  const analisar = async () => {
    setPhase("count"); setError(null); setSummary(null); setRows(null);
    try {
      const res = await base44.functions.invoke("exportTotvs", {
        mode: "count", doc, source_id: sourceId, start_date: start, end_date: end, statuses,
      });
      if (!res?.data?.success) throw new Error(res?.data?.error || "Falha na análise");
      setSummary(res.data.summary);
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    } finally {
      setPhase("idle");
    }
  };

  const extrair = async () => {
    const total = Number(summary?.total || 0);
    if (!total) return;
    setPhase("extract"); setError(null); setProgress(0);
    const acc = [];
    try {
      for (let offset = 0; offset < total; offset += PAGE_SIZE) {
        const res = await base44.functions.invoke("exportTotvs", {
          mode: "page", doc, source_id: sourceId, start_date: start, end_date: end, statuses,
          offset, page_size: PAGE_SIZE,
        });
        if (!res?.data?.success) throw new Error(res?.data?.error || "Falha na extração");
        const page = res.data.rows || [];
        acc.push(...page);
        setProgress(acc.length);
        if (page.length === 0) break;
      }
      setRows(acc);
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
      if (acc.length) setRows(acc);
    } finally {
      setPhase("idle");
    }
  };

  const busy = phase !== "idle";
  const total = Number(summary?.total || 0);

  return (
    <div className="space-y-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
        <div className="flex items-start gap-2">
          <ArrowRightLeft className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
          <p className="text-xs text-gray-400 leading-relaxed">
            Saneamento para migração ao TOTVS (Protheus). CAR sai no layout <b className="text-gray-200">SE1</b> e CAP no layout <b className="text-gray-200">SE2</b>, em arquivos separados.
            O código do parceiro são os <b className="text-gray-200">8 primeiros dígitos do CNPJ</b> e a loja são os <b className="text-gray-200">4 dígitos após a “/”</b> (CPF recebe loja 0001).
            Campos sem equivalente no Sisloc saem vazios e são apontados na coluna SANEAMENTO — nada é preenchido por suposição.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Documento</label>
            <select value={doc} onChange={(e) => setDoc(e.target.value)} disabled={busy} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
              <option value="car">CAR → SE1 (Contas a Receber)</option>
              <option value="cap">CAP → SE2 (Contas a Pagar)</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Emissão de</label>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} disabled={busy} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">até</label>
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} disabled={busy} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Status a importar</label>
            <div className="flex gap-2">
              {STATUS_OPTIONS[doc].map((s) => (
                <label key={s.id} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm cursor-pointer select-none ${statuses.includes(s.id) ? "border-purple-500 bg-purple-950/40 text-white" : "border-gray-700 bg-gray-800 text-gray-400"}`}>
                  <input type="checkbox" checked={statuses.includes(s.id)} onChange={() => toggleStatus(s.id)} disabled={busy} className="accent-purple-500" />
                  {s.label}
                </label>
              ))}
            </div>
          </div>
          <button onClick={analisar} disabled={busy} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg">
            {phase === "count" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Analisar base
          </button>
          {total > 0 && (
            <button onClick={extrair} disabled={busy} className="flex items-center gap-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg">
              {phase === "extract" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
              Extrair {total.toLocaleString("pt-BR")} títulos
            </button>
          )}
          {rows && rows.length > 0 && !busy && (
            <button onClick={() => downloadTotvsCsv({ doc, columns: layout || [], rows })} className="flex items-center gap-2 bg-green-700 hover:bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-lg">
              <Download className="w-4 h-4" /> Baixar {doc === "cap" ? "SE2" : "SE1"} ({rows.length.toLocaleString("pt-BR")})
            </button>
          )}
        </div>

        {phase === "extract" && (
          <div className="space-y-1">
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 transition-all" style={{ width: `${total ? Math.min((progress / total) * 100, 100) : 0}%` }} />
            </div>
            <p className="text-xs text-gray-500">
              Extraindo em blocos de {PAGE_SIZE.toLocaleString("pt-BR")} — {progress.toLocaleString("pt-BR")} de {total.toLocaleString("pt-BR")}. Mantenha esta aba aberta.
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-950/40 border border-red-800/50 rounded-lg px-4 py-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span className="text-red-300 text-xs">{error}</span>
        </div>
      )}

      {summary && <TotvsSummaryCards summary={summary} />}
      {rows && rows.length > 0 && layout && <TotvsPreviewTable columns={layout} rows={rows} />}
    </div>
  );
}