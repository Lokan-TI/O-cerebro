import { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useErpSource, ALL_SOURCES_ID } from "@/lib/ErpSourceContext";
import { buildTree, financeSummary, planIndex, ralos } from "@/lib/planoFinanceiro";
import FinanceiroFiltros from "@/components/financeiro/FinanceiroFiltros";
import NaturezaCards from "@/components/financeiro/NaturezaCards";
import DreCaixa from "@/components/financeiro/DreCaixa";
import RalosFinanceiros from "@/components/financeiro/RalosFinanceiros";
import BalanceteTree from "@/components/financeiro/BalanceteTree";
import SaidasMensais from "@/components/financeiro/SaidasMensais";
import FornecedoresSaida from "@/components/financeiro/FornecedoresSaida";
import QueryInspector from "@/components/erp/QueryInspector";
import { Landmark, AlertTriangle } from "lucide-react";

const hoje = new Date().toISOString().slice(0, 10);
const umAnoAtras = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);

export default function DetalhamentoFinanceiro() {
  const { selectedSource } = useErpSource();
  const [filtros, setFiltros] = useState({ start: umAnoAtras, end: hoje, regime: "baixa" });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const sourceId = selectedSource?.id && selectedSource.id !== ALL_SOURCES_ID ? selectedSource.id : undefined;

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("analyzeFinanceiro", {
        start_date: filtros.start,
        end_date: filtros.end,
        regime: filtros.regime,
        ...(sourceId ? { source_id: sourceId } : {}),
      });
      if (res.data?.error) setError(res.data.error);
      else setData(res.data);
    } catch (e) {
      setError("Não foi possível consultar o ERP agora. Detalhe: " + String(e?.message || e).slice(0, 200));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [sourceId]);

  const idx = useMemo(() => planIndex(data?.plano || []), [data]);
  const summary = useMemo(() => (data ? financeSummary(data) : null), [data]);
  const arvoreSaidas = useMemo(() => (data ? buildTree(data.saidas, idx) : []), [data, idx]);
  const arvoreEntradas = useMemo(() => (data ? buildTree(data.entradas, idx) : []), [data, idx]);
  const topRalos = useMemo(() => (summary ? ralos(summary) : []), [summary]);

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3 pr-14">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Landmark className="w-6 h-6 text-emerald-400" /> Detalhamento financeiro — DRE, balancete e ralos
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Todas as saídas de dinheiro abertas pelos 4 níveis de natureza financeira do plano do Sisloc, com separação
            entre CAPEX e OPEX.
          </p>
        </div>
        {data?.queries && <QueryInspector queries={data.queries} />}
      </div>

      <FinanceiroFiltros filtros={filtros} onChange={setFiltros} onApply={load} loading={loading} />

      {error && (
        <div className="border border-red-700/50 bg-red-950/30 rounded-xl p-4 text-sm text-red-300 flex gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {loading && !data && <div className="text-gray-500 text-center py-16">Montando balancete a partir do ERP…</div>}

      {summary && (
        <>
          <NaturezaCards summary={summary} />
          {summary.sinteticasTotal > 0 && (
            <div className="border border-amber-700/50 bg-amber-950/20 rounded-xl p-4 text-sm text-amber-200 flex gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                Parte das saídas está lançada em contas sintéticas (níveis 1 a 3, como “SAIDAS” ou “DESPESAS
                OPERACIONAIS”), sem conta analítica. Enquanto o financeiro não reclassificar esses títulos no ERP, esse
                valor não pode ser aberto por natureza.
              </span>
            </div>
          )}
          <DreCaixa summary={summary} regime={data.regime} />
          <RalosFinanceiros rows={topRalos} />
          <SaidasMensais mensal={data.mensal} />
          <BalanceteTree saidas={arvoreSaidas} entradas={arvoreEntradas} />
          <FornecedoresSaida fornecedores={data.fornecedores} idx={idx} />
        </>
      )}
    </div>
  );
}