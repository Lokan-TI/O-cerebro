import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useErpSource, ALL_SOURCES_ID } from "@/lib/ErpSourceContext";
import { useEmpresaFilter } from "@/lib/EmpresaFilterContext";
import { useErpSnapshot } from "@/lib/ErpSnapshotContext";
import { fetchClientesAtivos } from "@/components/erp/clientesAtivosCache";
import { computeRfm, rfmWindow } from "@/lib/rfm";
import { fmtCur } from "@/lib/erpFormat";
import RfmDistChart from "./RfmDistChart";
import RfmSegmentMap from "./RfmSegmentMap";
import RfmClassTable from "./RfmClassTable";
import RfmClientList from "./RfmClientList";

const YEARS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
const card = "bg-gray-900 border border-gray-800 rounded-xl p-4";

export default function TabClientesRfm() {
  const [year, setYear] = useState(YEARS[0]);
  const [state, setState] = useState({ loading: true, rows: null, error: null });
  const { selectedSource } = useErpSource();
  const { selectedEmpresa } = useEmpresaFilter();
  const { snapshot } = useErpSnapshot();
  const win = rfmWindow(year);
  const [sel, setSel] = useState(null);
  const pick = (type, key) => setSel((s) => (s?.type === type && s.key === key ? null : { type, key }));
  const segSel = sel?.type === "seg" ? sel.key : null;

  useEffect(() => {
    let alive = true;
    setState({ loading: true, rows: null, error: null });
    const sourceId = selectedSource?.id && selectedSource.id !== ALL_SOURCES_ID ? selectedSource.id : null;
    fetchClientesAtivos(sourceId, win.start, win.end, snapshot?.version, true)
      .then((d) => alive && setState({ loading: false, rows: d?.rows || [], error: null }))
      .catch((e) => alive && setState({ loading: false, rows: null, error: e.message }));
    return () => { alive = false; };
  }, [win.start, win.end, selectedSource?.id, snapshot?.version]);

  const rfm = useMemo(() => {
    if (!state.rows) return null;
    const rows = selectedEmpresa == null ? state.rows : state.rows.filter((r) => Number(r.cd_empresa) === Number(selectedEmpresa));
    return computeRfm(rows, win.end);
  }, [state.rows, selectedEmpresa, win.end]);

  return (
    <div className="space-y-4">
      <div className={`${card} flex flex-wrap items-center justify-between gap-3`}>
        <div>
          <h2 className="text-lg font-semibold text-white">Análise RFM (Recência, Frequência e Monetário)</h2>
          <p className="text-xs text-gray-400">Perfil dos clientes ativos nos últimos <b className="text-gray-200">12 meses</b> · {win.start.split("-").reverse().join("/")} a {win.end.split("-").reverse().join("/")}</p>
        </div>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="bg-gray-800 border border-gray-700 rounded-md text-sm text-gray-200 px-3 py-1.5">
          {YEARS.map((y, i) => <option key={y} value={y}>{i === 0 ? `Ano atual (${y})` : y}</option>)}
        </select>
      </div>

      {state.loading && <div className={`${card} flex items-center justify-center gap-2 text-sm text-gray-400 py-16`}><Loader2 className="w-4 h-4 animate-spin" /> Calculando RFM…</div>}
      {state.error && <div className={`${card} text-sm text-red-400`}>Erro ao carregar clientes: {state.error}</div>}
      {rfm && rfm.total === 0 && <div className={`${card} text-sm text-gray-400 text-center py-12`}>Nenhum cliente com faturamento no período.</div>}

      {rfm && rfm.total > 0 && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-4">
            <div className={`${card} space-y-4`}>
              <div><p className="text-xs text-gray-400">Receita</p><p className="text-lg font-semibold text-white">{fmtCur(rfm.receita)}</p></div>
              <div><p className="text-xs text-gray-400">Clientes ativos</p><p className="text-lg font-semibold text-white">{rfm.total.toLocaleString("pt-BR")}</p></div>
            </div>
            <div className={`${card} grid grid-cols-1 md:grid-cols-3 gap-4`}>
              {[["R", "Clientes por Recência", "#0ea5e9"], ["F", "Clientes por Frequência", "#6366f1"], ["M", "Clientes por Valor Monetário", "#a855f7"]].map(([d, t, c]) => (
                <RfmDistChart key={d} title={t} prefix={d} values={rfm.dist[d]} color={c}
                  selected={sel?.type === d ? sel.key : null} onSelect={(n) => pick(d, n)} />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4">
            <div className={card}><RfmSegmentMap segs={rfm.segs} total={rfm.total} selected={segSel} onSelect={(k) => pick("seg", k)} /></div>
            <div className={card}><p className="text-sm font-semibold text-white mb-2">Classificação RFM</p><RfmClassTable segs={rfm.segs} selected={segSel} onSelect={(k) => pick("seg", k)} /></div>
          </div>
          {sel ? <RfmClientList clients={rfm.clients} sel={sel} onClear={() => setSel(null)} />
            : <p className="text-xs text-gray-500 text-center">Clique em um segmento ou barra para ver a lista de clientes.</p>}
        </>
      )}
    </div>
  );
}