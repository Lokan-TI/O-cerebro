import { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2 } from "lucide-react";
import { buildRdQuery, MATCH_LABEL } from "@/lib/rdFunnelQuery";
import RdFunnelFilters from "./RdFunnelFilters";
import RdFunnelStages from "./RdFunnelStages";
import RdTraceTable from "./RdTraceTable";

const today = new Date();
const ago = new Date(today); ago.setFullYear(ago.getFullYear() - 1);
const d = (x) => x.toISOString().slice(0, 10);
const BASES = [["marketing", "Entrada pelo RD Marketing"], ["todos", "Todas as entradas RD"], ["conversas", "Entrada pelo RD Conversas"]];

export default function RdFunnelPanel() {
  const [filters, setFilters] = useState({ start: d(ago), end: d(today) });
  const [base, setBase] = useState("marketing");
  const [state, setState] = useState({ loading: true, data: null, error: "" });
  const [tick, setTick] = useState(0);
  const query = useMemo(() => buildRdQuery(filters), [filters]);

  useEffect(() => {
    setState((s) => ({ ...s, loading: true, error: "" }));
    base44.functions.invoke("rdFunnel", filters)
      .then(({ data }) => setState({ loading: false, data, error: data.error || "" }))
      .catch((e) => setState({ loading: false, data: null, error: e.message }));
  }, [filters, tick]);

  const data = state.data;
  return (
    <div className="space-y-5">
      <RdFunnelFilters value={filters} onChange={setFilters} />
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-5">
          <div className="flex flex-wrap gap-1.5 mb-5">
            {BASES.map(([k, l]) => (
              <button key={k} onClick={() => setBase(k)} className={`text-xs px-3 py-1.5 rounded-full transition ${base === k ? "bg-purple-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}>{l}</button>
            ))}
          </div>
          {state.loading ? <p className="text-sm text-gray-500 flex items-center gap-2 py-12 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Calculando funil…</p>
            : state.error ? <p className="text-sm text-red-400">{state.error}</p>
            : data[base].entrada === 0 ? <p className="text-sm text-gray-500 text-center py-12">Nenhuma pessoa nesta base de entrada para os filtros escolhidos. Se a fonte não sincronizou, veja a aba Conexões.</p>
            : <RdFunnelStages data={data[base]} />}
        </div>
        {data && !state.error && (
          <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-5 space-y-4 text-xs">
            <div><p className="text-gray-500">Registros RD no filtro</p><p className="text-xl font-semibold text-white">{data.registros.toLocaleString("pt-BR")}</p><p className="text-gray-500">{data.pessoas.toLocaleString("pt-BR")} pessoas distintas</p></div>
            <div className="space-y-1.5">
              <p className="text-gray-400 font-medium">Estado da correspondência</p>
              {Object.entries(data.by_status).map(([k, n]) => (
                <button key={k} onClick={() => setFilters((f) => ({ ...f, match: f.match === k ? "" : k }))} className="w-full flex justify-between hover:text-white text-gray-400">
                  <span className={`px-2 py-0.5 rounded-full ${MATCH_LABEL[k]?.[1]}`}>{MATCH_LABEL[k]?.[0] || k}</span><span>{n.toLocaleString("pt-BR")}</span>
                </button>
              ))}
            </div>
            <p className="text-gray-500 leading-relaxed border-t border-gray-800 pt-3">{data.criterio}</p>
          </div>
        )}
      </div>
      <RdTraceTable query={query} onChanged={() => setTick((t) => t + 1)} />
    </div>
  );
}