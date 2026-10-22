import { useMemo, useState } from "react";
import { Download, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import useQuedaLocacoes from "./useQuedaLocacoes";
import QuedaPeriodForm from "./QuedaPeriodForm";
import QuedaSummary from "./QuedaSummary";
import QuedaTable from "./QuedaTable";
import { STATUS, summarize, fmtD } from "./quedaCalc";
import { exportQueda } from "./quedaExport";

const FILTERS = [["quedas", "Em queda"], ["parou", "Pararam"], ["orc_sem_loc", "Queda com orçamento em B"], ["todos", "Todos"]];
const match = (f, c) => f === "todos" || (f === "parou" ? c.status === "parou"
  : (c.status === "queda" || c.status === "parou") && (f === "quedas" || c.orc_b > 0));

export default function QuedaLocacoes({ sourceId, empresa }) {
  const q = useQuedaLocacoes();
  const [filter, setFilter] = useState("quedas");
  const [text, setText] = useState("");
  const [sort, setSort] = useState({ key: "diff", dir: 1 });
  const [exp, setExp] = useState(null);
  const all = q.data?.clientes || [];
  const rows = useMemo(() => {
    const t = text.trim().toLowerCase();
    const list = all.filter((c) => match(filter, c) && (!t || c.nome.toLowerCase().includes(t) || c.doc.includes(t) || c.cd_pessoa === t));
    const v = (c) => (sort.key === "status" ? STATUS[c.status].label : c[sort.key] ?? -Infinity);
    return list.sort((a, b) => (v(a) > v(b) ? 1 : v(a) < v(b) ? -1 : 0) * sort.dir);
  }, [all, filter, text, sort]);
  const s = useMemo(() => summarize(all), [all]);
  const run = (p) => q.run({ ...p, source_id: sourceId, cd_empresa: empresa ?? null });
  const onSort = (key) => setSort((x) => ({ key, dir: x.key === key ? -x.dir : key === "nome" ? 1 : -1 }));
  const doExport = async () => {
    setExp("Preparando…");
    await exportQueda(q.params, rows, (d, t) => setExp(`${d}/${t}`)).catch((e) => alert(e.message));
    setExp(null);
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
      <div>
        <h3 className="text-base font-semibold text-white">Queda na frequência de locações</h3>
        <p className="text-xs text-gray-400">Fichas fechadas (com movimentação) iniciadas em cada período · renovações contadas à parte · orçamentos não fechados mapeados.</p>
      </div>
      <QuedaPeriodForm loading={q.loading} onRun={run} />
      {q.loading && <p className="flex items-center justify-center gap-2 text-sm text-gray-400 py-10"><Loader2 className="w-4 h-4 animate-spin" /> Consultando fichas no Sisloc…</p>}
      {q.error && <p className="text-sm text-red-400">{q.error}</p>}
      {q.data && all.length === 0 && <p className="text-sm text-gray-500 text-center py-8">Nenhuma ficha ou orçamento nos períodos informados.</p>}
      {q.data && all.length > 0 && (
        <>
          <p className="text-xs text-gray-400">Comparando <b className="text-gray-200">A: {fmtD(q.params.p1.start)} a {fmtD(q.params.p1.end)}</b> com <b className="text-gray-200">B: {fmtD(q.params.p2.start)} a {fmtD(q.params.p2.end)}</b></p>
          <QuedaSummary s={s} />
          <div className="flex flex-wrap items-center gap-2">
            {FILTERS.map(([k, l]) => (
              <button key={k} onClick={() => setFilter(k)} className={`px-3 py-1 rounded-full text-xs border ${filter === k ? "bg-violet-600 border-violet-500 text-white" : "border-gray-700 text-gray-400 hover:text-white"}`}>{l}</button>
            ))}
            <div className="relative ml-auto">
              <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-gray-500" />
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Cliente ou documento" className="bg-gray-950 border border-gray-700 rounded-md pl-7 pr-2 py-1 text-xs text-white" />
            </div>
            <Button size="sm" variant="outline" disabled={!rows.length || !!exp} onClick={doExport} className="border-gray-700 bg-transparent text-gray-200">
              {exp ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Download className="w-3.5 h-3.5 mr-1" />}{exp || `Excel (${rows.length})`}
            </Button>
          </div>
          <QuedaTable rows={rows} params={q.params} sort={sort} onSort={onSort} />
        </>
      )}
    </div>
  );
}