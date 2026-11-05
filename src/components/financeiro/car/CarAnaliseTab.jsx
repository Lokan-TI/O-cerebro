import { useState, useEffect, useMemo } from "react";
import { useErpSource, ALL_SOURCES_ID } from "@/lib/ErpSourceContext";
import { useEmpresaFilter } from "@/lib/EmpresaFilterContext";
import { sumRows } from "@/lib/carAnalise";
import useCarDados from "@/lib/useCarDados";
import { Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import CarKpis from "@/components/financeiro/car/CarKpis";
import CarVisaoGeral from "@/components/financeiro/car/CarVisaoGeral";
import CarEmpresaDetalhe from "@/components/financeiro/car/CarEmpresaDetalhe";
import CarVencidosView from "@/components/financeiro/car/CarVencidosView";

const today = () => new Date().toISOString().slice(0, 10);
const byEmpresa = (list, emp) => (list ? list.filter((r) => emp == null || r.cd_empresa === emp) : null);

// Sub-aba "CAR por empresa": análise completa de Contas a Receber (por data de emissão).
// Mostra na hora o último resultado salvo e atualiza em segundo plano.
export default function CarAnaliseTab({ dateRange }) {
  const { selectedSource } = useErpSource();
  const { selectedEmpresa } = useEmpresaFilter();
  const sourceId = selectedSource && selectedSource.id !== ALL_SOURCES_ID ? selectedSource.id : undefined;
  const [start, setStart] = useState(dateRange?.start || "2013-01-01");
  const [end, setEnd] = useState(dateRange?.end || today());
  const [applied, setApplied] = useState({ start, end });
  const [view, setView] = useState("geral");

  useEffect(() => {
    if (!dateRange?.start || !dateRange?.end) return;
    setStart(dateRange.start); setEnd(dateRange.end);
    setApplied({ start: dateRange.start, end: dateRange.end });
  }, [dateRange?.start, dateRange?.end]);

  const { data, loading, error, carregar } = useCarDados({ sourceId, ...applied });
  const consultar = () => (start === applied.start && end === applied.end ? carregar() : setApplied({ start, end }));

  const rows = useMemo(() => byEmpresa(data?.rows, selectedEmpresa) || [], [data?.rows, selectedEmpresa]);
  const curvas = useMemo(() => byEmpresa(data?.curvas, selectedEmpresa), [data?.curvas, selectedEmpresa]);
  const titulos = useMemo(() => byEmpresa(data?.titulos, selectedEmpresa) || [], [data?.titulos, selectedEmpresa]);
  const tabBtn = (id, label) => (
    <button onClick={() => setView(id)} className={`px-4 py-2 rounded-lg text-sm font-medium ${view === id ? "bg-purple-600 text-white" : "text-gray-400 hover:text-gray-200"}`}>{label}</button>
  );

  return (
    <div className="space-y-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Emissão de</label>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">até</label>
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
        </div>
        <button onClick={consultar} disabled={loading} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Consultar
        </button>
        {data?.updated_at && (
          <span className="text-xs text-gray-500">{loading ? "Atualizando…" : `Atualizado ${new Date(data.updated_at).toLocaleString("pt-BR")}`}</span>
        )}
        <div className="flex gap-1 bg-gray-800 border border-gray-700 rounded-xl p-1 ml-auto">
          {tabBtn("geral", "Análise geral")}
          {tabBtn("empresa", "Detalhe por empresa")}
          {tabBtn("vencidos", "Vencidos e recuperação")}
        </div>
      </div>

      {error && (
        <div className="bg-red-950/40 border border-red-800/50 rounded-lg px-4 py-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" /><span className="text-red-300 text-xs">{error}</span>
        </div>
      )}
      {loading && !data?.rows && (
        <div className="text-gray-500 p-8 text-center flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Consultando o banco…</div>
      )}

      {data?.rows && (
        <>
          <CarKpis t={sumRows(rows)} />
          <p className="text-xs text-gray-500">Por data de emissão · Inadimplência = vencido sem baixa ÷ total (liquidado + a vencer + vencido) · provisório e cancelado fora do total.</p>
          {view === "geral" && <CarVisaoGeral rows={rows} />}
          {view === "empresa" && <CarEmpresaDetalhe rows={rows} />}
          {view === "vencidos" && <CarVencidosView curvas={curvas} titulos={titulos} />}
        </>
      )}
    </div>
  );
}