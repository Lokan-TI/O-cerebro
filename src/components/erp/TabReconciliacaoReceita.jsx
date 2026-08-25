import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useErpSource } from "@/lib/ErpSourceContext";
import { useGlobalFilter } from "@/lib/GlobalFilterContext";
import QueryInspector from "@/components/erp/QueryInspector";
import { RefreshCw, AlertTriangle, ShieldQuestion, GitCompareArrows, Database } from "lucide-react";

const fmt = (v) =>
  (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const fmtNum = (v) => (Number(v) || 0).toLocaleString("pt-BR");

const BRANCH_LABELS = {
  locacao: "Locação",
  venda: "Venda",
  manutencao: "Manutenção / OM",
  servico: "Serviços",
  indenizacao: "Indenizações",
};

export default function TabReconciliacaoReceita() {
  const { selectedSource } = useErpSource();
  const { period } = useGlobalFilter();
  const [mtr, setMtr] = useState(null);
  const [sisloc, setSisloc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const run = async () => {
    if (!selectedSource) return;
    setLoading(true);
    setError(null);
    setMtr(null);
    setSisloc(null);
    try {
      // Sequencial por propósito: evita lançar dois workloads pesados no Sisloc ao mesmo tempo.
      const mtrRes = await base44.functions.invoke("reconcileRevenue", {
        source_id: selectedSource.id,
        period_start: period.start,
        period_end: period.endExclusive,
      });
      const mtrData = mtrRes?.data || mtrRes;
      if (mtrData?.error) throw new Error(mtrData.error);
      setMtr(mtrData);

      const sislocRes = await base44.functions.invoke("receitaSislocRateio", {
        source_id: selectedSource.id,
        start_date: period.start,
        end_date_exclusive: period.endExclusive,
        period_type: 1,
        cd_grupo: 0,
        cd_pessoa_fun: 0,
        cd_equfamilia: 0,
      });
      const sislocData = sislocRes?.data || sislocRes;
      setSisloc(sislocData);
      if (sislocData?.success === false && !sislocData?.partial) {
        throw new Error(sislocData?.error || "Falha ao executar Receita por Grupo SISLOC.");
      }
    } catch (e) {
      setError(e?.response?.data?.error || e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const mtrReference = (mtr?.candidates || []).find((c) => c.id === "A_vl_faturamento")?.total ?? null;
  const sislocTotal = sisloc?.total ?? null;
  const crossDiff = mtrReference != null && sislocTotal != null ? Number(mtrReference) - Number(sislocTotal) : null;
  const crossDiffPct = sislocTotal ? (crossDiff / Number(sislocTotal)) * 100 : null;
  const dg = mtr?.diagnostics || null;
  const diagnosticSteps = dg ? [
    { id: "nf", label: "1. Faturamento NF atual", detail: "nf.dt_emi_nf + universo fiscal do Cérebro", value: Number(dg.current_nf_total || 0), previous: null },
    { id: "view", label: "2. Mesmas NFs pela data da view", detail: "v_nf_emissao.dt_emissao", value: Number(dg.view_date_same_universe_total || 0), previous: Number(dg.current_nf_total || 0) },
    { id: "linked", label: "3. NFs ligadas aos fatos do relatório", detail: `fl_fatura / ped_ven / orcos / indenização · ${fmtNum(dg.report_linked_invoice_count)} NFs`, value: Number(dg.report_linked_nf_total || 0), previous: Number(dg.view_date_same_universe_total || 0) },
    { id: "nffatur", label: "4. Base nffatur das NFs ligadas", detail: "Σ nffatur.vl_nffatur antes do rateio por componentes", value: Number(dg.report_linked_nffatur_total || 0), previous: Number(dg.report_linked_nf_total || 0) },
  ] : [];

  const lineage = (sisloc?.lineage || []).map((q) => ({
    label: BRANCH_LABELS[q.branch] || q.branch,
    description: "SQL reproduzida do full log do TGersReceitaGrupoList",
    sql: q.sql,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-white">Reconciliação de Receita</h2>
          <p className="text-xs text-gray-500 mt-0.5 max-w-3xl">
            Compara duas semânticas diferentes sem misturá-las: MTR-001 (faturamento bruto de NF) e o benchmark
            Receita por Grupo do Sisloc. Período aplicado: {period.start} → {period.end}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lineage.length > 0 && <QueryInspector queries={lineage} title="SQLs — Receita por Grupo SISLOC" />}
          <button onClick={run} disabled={loading || !selectedSource}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-lg text-sm text-white">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Reconciliando…" : "Executar reconciliação"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-start gap-2">
            <Database className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-white">MTR-001 · Faturamento NF</p>
              <p className="text-xs text-gray-500 mt-1">Fato: NF · valor: nf.vl_faturamento · data: nf.dt_emi_nf.</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-start gap-2">
            <GitCompareArrows className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-white">SISLOC-RECEITA-GRUPO · Benchmark</p>
              <p className="text-xs text-gray-500 mt-1">Fatos múltiplos · rateio: nffatur.vl_nffatur · data: v_nf_emissao.dt_emissao.</p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-950/40 border border-red-900 rounded-lg p-3 text-sm text-red-300">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {mtr && (
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-blue-300">1 · Reconciliação interna do MTR-001</h3>
            <p className="text-xs text-gray-500">Candidatos de valor dentro do universo de NF; não compara automaticamente com Receita por Grupo.</p>
          </div>

          <div className="flex items-start gap-2 bg-amber-950/30 border border-amber-900/60 rounded-lg p-3 text-sm text-amber-200/90">
            <ShieldQuestion className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              {mtr.note} Universo: {fmtNum(mtr.universe?.invoice_count)} NFs válidas por <span className="font-mono">{mtr.period?.date_field}</span>.
            </span>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-950 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Candidato</th>
                  <th className="text-right px-4 py-2 font-medium">Total</th>
                  <th className="text-right px-4 py-2 font-medium">Δ vs. referência</th>
                  <th className="text-right px-4 py-2 font-medium">Δ %</th>
                </tr>
              </thead>
              <tbody>
                {(mtr.candidates || []).map((c) => (
                  <tr key={c.id} className="border-t border-gray-800">
                    <td className="px-4 py-2 text-gray-300">{c.label}</td>
                    <td className="px-4 py-2 text-right text-white font-medium">{fmt(c.total)}</td>
                    <td className="px-4 py-2 text-right text-gray-400">{c.diff_vs_reference ? fmt(c.diff_vs_reference) : "—"}</td>
                    <td className={`px-4 py-2 text-right ${c.diff_pct_vs_reference ? "text-red-400" : "text-gray-500"}`}>
                      {c.diff_pct_vs_reference ? `${c.diff_pct_vs_reference}%` : "referência"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {mtr?.diagnostics && (
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-cyan-300">2 · Diagnóstico da divergência em camadas</h3>
            <p className="text-xs text-gray-500">
              Decompõe o total sem assumir que Faturamento NF e Receita por Grupo são equivalentes. Cada Δ mostra quanto muda ao aproximar o universo do contrato real do SISLOC.
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-950 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Camada</th>
                  <th className="text-right px-4 py-2 font-medium">Total</th>
                  <th className="text-right px-4 py-2 font-medium">Δ da camada</th>
                </tr>
              </thead>
              <tbody>
                {diagnosticSteps.map((s) => {
                  const delta = s.previous == null ? null : s.value - s.previous;
                  return (
                    <tr key={s.id} className="border-t border-gray-800">
                      <td className="px-4 py-3">
                        <div className="text-gray-200 font-medium">{s.label}</div>
                        <div className="text-[11px] text-gray-600 mt-0.5">{s.detail}</div>
                      </td>
                      <td className="px-4 py-3 text-right text-white font-medium">{fmt(s.value)}</td>
                      <td className={`px-4 py-3 text-right ${delta == null ? "text-gray-600" : Math.abs(delta) < 0.01 ? "text-green-400" : "text-amber-300"}`}>
                        {delta == null ? "—" : fmt(delta)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {mtr && sisloc && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-white">Comparação direta · mesma janela</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-gray-900 border border-blue-800/50 rounded-xl p-4">
              <p className="text-xs text-gray-500 uppercase">Faturamento NF</p>
              <p className="text-lg font-bold text-white mt-1">{fmt(mtrReference)}</p>
              <p className="text-[11px] text-gray-600 mt-1">Σ nf.vl_faturamento</p>
            </div>
            <div className="bg-gray-900 border border-purple-800/50 rounded-xl p-4">
              <p className="text-xs text-gray-500 uppercase">Receita por Grupo SISLOC</p>
              <p className="text-lg font-bold text-white mt-1">{fmt(sislocTotal)}</p>
              <p className="text-[11px] text-gray-600 mt-1">TGersReceitaGrupoList</p>
            </div>
            <div className="bg-gray-900 border border-amber-800/50 rounded-xl p-4">
              <p className="text-xs text-gray-500 uppercase">Diferença</p>
              <p className="text-lg font-bold text-white mt-1">{fmt(crossDiff)}</p>
              <p className="text-[11px] text-gray-600 mt-1">NF − Receita por Grupo</p>
            </div>
            <div className="bg-gray-900 border border-amber-800/50 rounded-xl p-4">
              <p className="text-xs text-gray-500 uppercase">Diferença %</p>
              <p className="text-lg font-bold text-white mt-1">{crossDiffPct == null ? "—" : `${crossDiffPct.toFixed(3)}%`}</p>
              <p className="text-[11px] text-gray-600 mt-1">base = Receita por Grupo</p>
            </div>
          </div>
        </section>
      )}

      {sisloc && (
        <section className="space-y-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h3 className="text-sm font-semibold text-purple-300">3 · Receita por Grupo SISLOC</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                TGersReceitaGrupoList · tipo_periodo=1 · escopo de empresas reproduzido literalmente do full log do SISLOC.
              </p>
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-full border ${sisloc.partial ? "border-amber-700 text-amber-300 bg-amber-950/30" : "border-green-700 text-green-300 bg-green-950/30"}`}>
              {sisloc.metric?.status || (sisloc.partial ? "PARTIAL" : "RECONCILIATION_READY")}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {Object.entries(BRANCH_LABELS).map(([key, label]) => {
              const b = sisloc.branches?.[key] || {};
              return (
                <div key={key} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <p className="text-xs text-gray-500 uppercase">{label}</p>
                  <p className="text-lg font-bold text-white mt-1">{fmt(b.valor)}</p>
                  <p className="text-[11px] text-gray-600 mt-1">{fmtNum(b.rows)} linhas</p>
                  {b.error && <p className="text-[11px] text-red-400 mt-1">Erro no bloco</p>}
                </div>
              );
            })}
            <div className="bg-purple-950/30 border border-purple-700/50 rounded-xl p-4">
              <p className="text-xs text-purple-300 uppercase">Total consolidado</p>
              <p className="text-lg font-bold text-white mt-1">{fmt(sisloc.total)}</p>
              <p className="text-[11px] text-gray-500 mt-1">Soma dos 5 fatos</p>
            </div>
          </div>

          {sisloc.errors && Object.keys(sisloc.errors).length > 0 && (
            <div className="bg-amber-950/30 border border-amber-800 rounded-lg p-3 text-xs text-amber-200 space-y-1">
              <p className="font-medium">A execução foi parcial. Blocos com erro:</p>
              {Object.entries(sisloc.errors).map(([k, v]) => <p key={k}>{BRANCH_LABELS[k] || k}: {String(v)}</p>)}
            </div>
          )}

          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800">
              <p className="text-sm font-medium text-white">Consolidação por grupo e representante</p>
              <p className="text-xs text-gray-500">Abertura dos cinco fatos após aplicação do mesmo escopo e período.</p>
            </div>
            <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-950 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="text-left px-3 py-2">Grupo</th>
                    <th className="text-left px-3 py-2">Representante</th>
                    <th className="text-right px-3 py-2">Locação</th>
                    <th className="text-right px-3 py-2">Venda</th>
                    <th className="text-right px-3 py-2">Manutenção</th>
                    <th className="text-right px-3 py-2">Serviços</th>
                    <th className="text-right px-3 py-2">Indenização</th>
                    <th className="text-right px-3 py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(sisloc.by_group || []).map((r, i) => (
                    <tr key={`${r.cd_grupo}-${r.nm_pessoa}-${i}`} className="border-t border-gray-800/70">
                      <td className="px-3 py-2 text-gray-300">#{r.cd_grupo} · {r.nm_grupo || "(sem grupo)"}</td>
                      <td className="px-3 py-2 text-gray-400">{r.nm_pessoa || "—"}</td>
                      <td className="px-3 py-2 text-right text-gray-300">{fmt(r.vl_locacao)}</td>
                      <td className="px-3 py-2 text-right text-gray-300">{fmt(r.vl_venda)}</td>
                      <td className="px-3 py-2 text-right text-gray-300">{fmt(r.vl_manutencao)}</td>
                      <td className="px-3 py-2 text-right text-gray-300">{fmt(r.vl_servico)}</td>
                      <td className="px-3 py-2 text-right text-gray-300">{fmt(r.vl_indenizacao)}</td>
                      <td className="px-3 py-2 text-right text-white font-medium">{fmt(r.vl_total)}</td>
                    </tr>
                  ))}
                  {(sisloc.by_group || []).length === 0 && (
                    <tr><td colSpan={8} className="text-center py-8 text-gray-600">Nenhuma linha retornada.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="text-[11px] text-gray-500 leading-relaxed">
            Escopo temporal interno: [{sisloc.analysis_context?.period_start}, {sisloc.analysis_context?.period_end_exclusive}).
            Data final exibida ao usuário: {sisloc.analysis_context?.period_end_inclusive}. Empresas do relatório: {(sisloc.analysis_context?.report_companies || []).join(", ")}.
          </div>
        </section>
      )}
    </div>
  );
}
