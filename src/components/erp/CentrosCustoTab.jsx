import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useErpSource, ALL_SOURCES_ID } from "@/lib/ErpSourceContext";
import CustoMacroCards from "@/components/erp/CustoMacroCards";
import CustoGrupoTree from "@/components/erp/CustoGrupoTree";
import { buildCustoTree, buildMacroMensal } from "@/components/erp/custoCentros";
import { fmtCur, fmtNum } from "@/lib/erpFormat";
import { Loader2, AlertTriangle, RefreshCw, Search, Info } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

// Sub-aba "Centros de custo" — onde o dinheiro está saindo, pela hierarquia do
// plano financeiro (grupo → bloco → conta analítica), com leitura Operacional x Administrativo.
export default function CentrosCustoTab({ dateRange }) {
  const { selectedSource } = useErpSource();
  const sourceId = selectedSource && selectedSource.id !== ALL_SOURCES_ID ? selectedSource.id : undefined;

  const [start, setStart] = useState(dateRange?.start || "2025-01-01");
  const [end, setEnd] = useState(dateRange?.end || new Date().toISOString().slice(0, 10));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [q, setQ] = useState("");

  const carregar = async () => {
    setLoading(true); setError(null);
    try {
      const res = await base44.functions.invoke("listCentrosCusto", {
        source_id: sourceId, start_date: start, end_date: end,
      });
      if (!res?.data?.success) throw new Error(res?.data?.error || "Falha na consulta");
      setData(res.data);
    } catch (err) {
      setError(err?.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, [sourceId]); // eslint-disable-line react-hooks/exhaustive-deps

  const { tree, totals, macro, fora } = useMemo(
    () => buildCustoTree(data?.contas, data?.nos, q),
    [data, q]
  );
  const mensal = useMemo(() => buildMacroMensal(data?.mensal), [data]);

  return (
    <div className="space-y-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Emissão de</label>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} disabled={loading} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">até</label>
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} disabled={loading} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
        </div>
        <button onClick={carregar} disabled={loading} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Consultar
        </button>
        <div className="relative ml-auto">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar conta…" className="bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white w-56" />
        </div>
      </div>

      {error && (
        <div className="bg-red-950/40 border border-red-800/50 rounded-lg px-4 py-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span className="text-red-300 text-xs">{error}</span>
        </div>
      )}

      {loading && !data && (
        <div className="text-gray-500 p-8 text-center flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Consultando o banco…
        </div>
      )}

      {data && (
        <>
          <div className="bg-blue-950/20 border border-blue-900/40 rounded-lg px-4 py-2 flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <span className="text-blue-200/80 text-xs">
              O cadastro de centros de custo do Sisloc está vazio — a classificação de despesa usada aqui é a
              hierarquia do plano financeiro (grupo → bloco → conta analítica) sobre as Contas a Pagar.
              {fora.vl_total > 0 && <> {fmtCur(fora.vl_total)} em {fmtNum(fora.qtd)} títulos ficaram fora por estarem lançados em contas de entrada ou sem conta vinculada.</>}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Kpi label="Despesa total" value={fmtCur(totals.vl_total)} sub={`${fmtNum(totals.qtd)} títulos · exclui cancelados`} color="text-white" />
            <Kpi label="Já pago" value={fmtCur(totals.vl_pago)} sub="Saiu do caixa" color="text-green-400" />
            <Kpi label="Em aberto" value={fmtCur(totals.vl_aberto)} sub={`Vencido: ${fmtCur(totals.vl_vencido)}`} color="text-amber-400" />
            <Kpi
              label="Operacional x Administrativo"
              value={macro.administrativo?.vl_total > 0 ? `${((macro.operacional?.vl_total || 0) / macro.administrativo.vl_total).toFixed(2)}x` : "—"}
              sub={`Oper. ${fmtCur(macro.operacional?.vl_total)} · Adm. ${fmtCur(macro.administrativo?.vl_total)}`}
              color="text-purple-300"
            />
          </div>

          <CustoMacroCards macro={macro} total={totals.vl_total} />

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-white font-semibold text-sm mb-1">Saída de caixa por macro-categoria</h3>
            <p className="text-xs text-gray-500 mb-4">Pagamentos baixados no período, pela data da baixa</p>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={mensal}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                <XAxis dataKey="label" stroke="#666" fontSize={11} />
                <YAxis stroke="#666" fontSize={11} tickFormatter={(v) => fmtCur(v).replace("R$", "")} />
                <Tooltip contentStyle={{ backgroundColor: "#111", border: "1px solid #333" }} formatter={(v) => fmtCur(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="operacional" name="Operacional" stackId="c" fill="#3b82f6" />
                <Bar dataKey="administrativo" name="Administrativo" stackId="c" fill="#a855f7" />
                <Bar dataKey="comercial" name="Comercial" stackId="c" fill="#10b981" />
                <Bar dataKey="financeiro" name="Financeiro" stackId="c" fill="#f59e0b" />
                <Bar dataKey="impostos" name="Impostos" stackId="c" fill="#ef4444" />
                <Bar dataKey="investimento" name="Investimentos" stackId="c" fill="#06b6d4" />
                <Bar dataKey="outros" name="Outros" stackId="c" fill="#64748b" />
                <Bar dataKey="nao_classificado" name="Sem classificação" stackId="c" fill="#374151" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {tree.map((g) => <CustoGrupoTree key={g.key} grupo={g} total={totals.vl_total} />)}
          {tree.length === 0 && <div className="text-gray-600 text-center py-8 text-sm">Nenhuma despesa encontrada para o filtro.</div>}
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, sub, color }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="text-xs text-gray-500 uppercase mb-1">{label}</div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-600 mt-1">{sub}</div>
    </div>
  );
}