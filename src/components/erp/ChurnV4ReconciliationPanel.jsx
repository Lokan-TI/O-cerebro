import { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { AlertTriangle, CheckCircle2, FlaskConical, Loader2, RefreshCw } from "lucide-react";

const num = (v) => Number(v || 0).toLocaleString("pt-BR");
const pct = (v) => `${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%`;
const dateBr = (v) => v ? new Date(`${String(v).slice(0, 10)}T00:00:00`).toLocaleDateString("pt-BR") : "—";

const CASE_LABELS = {
  FULL_LOG_GROUND_TRUTH_676399: "Caso full log · ficha 676399",
  FALSO_CHURN_V3_CONTRATO_ATIVO: "Falso churn v3 · contrato ativo",
  FALSO_CHURN_V3_ANCORA_TEMPORAL: "Falso churn v3 · âncora temporal",
  FICHA_ABERTA_STALE: "Ficha aberta stale",
  INCONSISTENCIA_OPERACIONAL: "Inconsistência operacional",
  UNIVERSO_FISCAL_DIVERGENTE: "Universo fiscal divergente",
  MULTIPLAS_FICHAS_UMA_ATIVA: "Múltiplas fichas · uma ativa",
  ATIVO_CONTRATO_CONTROLE: "Controle positivo · ativo",
  ENCERRADO_PROTEGIDO_CONTROLE: "Controle · encerrado protegido",
  CHURN_CONFIRMADO_CONTROLE: "Controle · churn confirmado",
  ATIVADO_SEM_NF_VINCULADA: "Ativado sem NF vinculada",
  FICHA_NUNCA_ATIVADA: "Ficha nunca ativada",
  SAZONAL_12_A_13_MESES: "Sazonal · 12 a 13 meses",
};

const LABELS = {
  POPULACAO_V3_OMITE_CLIENTE_ATIVADO: "Cliente ativado fora da coorte v3",
  V4_ATIVO_COM_INCONSISTENCIA: "Ativo com inconsistência operacional",
  AUDITORIA_OPERACIONAL_V4: "Auditoria operacional v4",
  FALSO_CHURN_V3_CONTRATO_ATIVO: "Falso churn v3 · contrato ativo",
  FALSO_CHURN_V3_ANCORA_TEMPORAL: "Falso churn v3 · âncora temporal",
  FICHA_ABERTA_STALE_V3_EXIGE_AUDITORIA: "Ficha aberta stale v3 · exige auditoria",
  UNIVERSO_FISCAL_V3_EXCLUI_NF_VINCULADA: "NF vinculada fora do universo fiscal v3",
  SEM_DIVERGENCIA_REGRA: "Sem divergência de regra",
};

function safeJson(value, fallback) {
  try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
}

function Kpi({ label, value, sub }) {
  return (
    <div className="bg-gray-950 border border-gray-800 rounded-lg p-3">
      <div className="text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className="text-xl font-semibold text-white mt-1">{value}</div>
      {sub && <div className="text-[11px] text-gray-600 mt-1">{sub}</div>}
    </div>
  );
}

export default function ChurnV4ReconciliationPanel({ sourceId, asOfDate, periodStart, periodEnd, inactivityMonths = 13 }) {
  const [data, setData] = useState(null);
  const [auditCases, setAuditCases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedAuditId, setSelectedAuditId] = useState(null);
  const [reviewDraft, setReviewDraft] = useState({ sisloc_observed_status: "", verdict: "pending", explanation: "" });
  const [savingReview, setSavingReview] = useState(false);

  const loadCasesForRun = async (runId) => {
    if (!runId) return [];
    const cases = await base44.entities.ChurnV4AuditCase.filter({ run_id: runId }, "-priority", 100);
    setAuditCases(cases || []);
    return cases || [];
  };

  const hydratePersistedRun = async (runRecord) => {
    if (!runRecord) return;
    const cases = await loadCasesForRun(runRecord.run_id);
    const evidence = cases.flatMap((c) => safeJson(c.evidence_json, {})?.fichas || []);
    const top = cases
      .filter((c) => c.divergence_type && c.divergence_type !== "SEM_DIVERGENCIA_REGRA")
      .map((c) => ({
        cd_pessoa: c.cd_pessoa,
        nm_pessoa: c.nm_pessoa,
        divergence_type: c.divergence_type,
        v3_status: c.v3_status,
        v4_status: c.v4_status,
        relationship_end_date: c.relationship_end_date,
        churn_date: c.churn_date,
        active_operational_fichas: c.active_operational_fichas,
        inconsistent_fichas: c.inconsistent_fichas,
      }));
    setData({
      success: true,
      persisted: true,
      run_id: runRecord.run_id,
      summary: safeJson(runRecord.summary_json, {}),
      period_churn: safeJson(runRecord.period_churn_json, {}),
      divergence_breakdown: safeJson(runRecord.divergence_breakdown_json, []),
      top_divergences: top,
      ficha_evidence: evidence,
      persisted_run: runRecord,
    });
    setSelectedCustomer(top?.[0]?.cd_pessoa || cases?.[0]?.cd_pessoa || null);
    setSelectedAuditId(cases?.[0]?.id || null);
  };

  useEffect(() => {
    let cancelled = false;
    const loadLatest = async () => {
      setLoadingSaved(true);
      try {
        const list = sourceId
          ? await base44.entities.ChurnV4ReconciliationRun.filter({ source_id: sourceId }, "-generated_at", 1)
          : await base44.entities.ChurnV4ReconciliationRun.list("-generated_at", 1);
        if (!cancelled && list?.[0]) await hydratePersistedRun(list[0]);
      } catch {
        // A ausência de run persistido não impede uma nova execução.
      } finally {
        if (!cancelled) setLoadingSaved(false);
      }
    };
    loadLatest();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceId]);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("reconcileRentalChurnV4", {
        ...(sourceId ? { source_id: sourceId } : {}),
        as_of_date: asOfDate,
        period_start: periodStart,
        period_end: periodEnd,
        inactivity_months: inactivityMonths,
        max_divergences: 200,
        detail_limit: 80,
        include_details: true,
        persist: true,
      });
      const result = res?.data || res;
      if (!result?.success) throw new Error(result?.error || "Falha na reconciliação v4.");
      setData(result);
      setSelectedCustomer(result?.top_divergences?.[0]?.cd_pessoa || null);
      const cases = await loadCasesForRun(result.run_id);
      setSelectedAuditId(cases?.[0]?.id || null);
      if (result?.persistence_warning) setError(result.persistence_warning);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  const selectedEvidence = useMemo(() => {
    if (!selectedCustomer || !data?.ficha_evidence) return [];
    return data.ficha_evidence.filter((r) => String(r.cd_pessoa) === String(selectedCustomer));
  }, [data, selectedCustomer]);

  const selectedAudit = useMemo(
    () => auditCases.find((c) => String(c.id) === String(selectedAuditId)) || null,
    [auditCases, selectedAuditId],
  );

  useEffect(() => {
    if (!selectedAudit) return;
    setReviewDraft({
      sisloc_observed_status: selectedAudit.sisloc_observed_status || "",
      verdict: selectedAudit.verdict || "pending",
      explanation: selectedAudit.explanation || "",
    });
    setSelectedCustomer(selectedAudit.cd_pessoa || null);
  }, [selectedAudit]);

  const auditStats = useMemo(() => ({
    total: auditCases.length,
    pending: auditCases.filter((c) => !c.reviewed || c.verdict === "pending").length,
    match: auditCases.filter((c) => c.verdict === "match").length,
    explained: auditCases.filter((c) => c.verdict === "explained").length,
    fail: auditCases.filter((c) => c.verdict === "fail").length,
  }), [auditCases]);

  const saveReview = async () => {
    if (!selectedAudit) return;
    setSavingReview(true);
    setError(null);
    try {
      const user = await base44.auth.me();
      const reviewed = reviewDraft.verdict !== "pending";
      await base44.entities.ChurnV4AuditCase.update(selectedAudit.id, {
        sisloc_observed_status: reviewDraft.sisloc_observed_status,
        verdict: reviewDraft.verdict,
        reviewed,
        explanation: reviewDraft.explanation,
        reviewer_name: user?.full_name || user?.email || "",
        reviewed_at: reviewed ? new Date().toISOString() : (selectedAudit.reviewed_at || ""),
      });
      const cases = await loadCasesForRun(data?.run_id || selectedAudit.run_id);
      const pending = cases.filter((c) => !c.reviewed || c.verdict === "pending").length;
      const fail = cases.filter((c) => c.verdict === "fail").length;
      const runs = await base44.entities.ChurnV4ReconciliationRun.filter({ run_id: data?.run_id || selectedAudit.run_id }, "-generated_at", 1);
      if (runs?.[0]) {
        await base44.entities.ChurnV4ReconciliationRun.update(runs[0].id, {
          unexplained_divergences: fail,
          status: pending > 0 ? "reviewing" : fail > 0 ? "failed" : "candidate",
          trusted: false,
          notes: pending > 0
            ? `Ground truth em andamento: ${pending} caso(s) pendente(s), ${fail} falha(s) não explicada(s).`
            : fail > 0
              ? `Ground truth concluído com ${fail} falha(s) não explicada(s). Regra não pode ser promovida.`
              : "Amostra dirigida concluída sem falhas não explicadas. Ainda requer decisão formal antes de promover TRUSTED.",
        });
      }
    } catch (e) {
      setError(`Falha ao salvar homologação: ${String(e?.message || e)}`);
    } finally {
      setSavingReview(false);
    }
  };

  const s = data?.summary || {};
  const pc = data?.period_churn || {};

  return (
    <div className="bg-gray-900 border border-amber-800/50 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-gray-800 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-white">Homologação Churn v4 · SISLOC Full Log</h3>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800">NÃO OFICIAL</span>
          </div>
          <p className="text-xs text-gray-500 mt-1 max-w-4xl">
            Reconciliação paralela v3 × v4. A v4 usa saldo físico, devolução, cobertura de faturamento, encerramento e NF vinculada à ficha. Nenhum resultado deste painel substitui o churn atual até a validação dirigida contra o SISLOC atingir zero divergência não explicada.
          </p>
          {data?.run_id && <p className="text-[11px] text-gray-600 mt-1">Run: <span className="text-gray-400 font-mono">{data.run_id}</span>{data.persisted ? " · carregado do histórico" : " · execução atual persistida"}</p>}
        </div>
        <button
          onClick={run}
          disabled={loading || !asOfDate}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-medium"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {loading ? "Reconciliando..." : "Executar reconciliação v4"}
        </button>
      </div>

      {error && (
        <div className="m-4 p-3 rounded-lg bg-red-950/30 border border-red-800 text-sm text-red-300 flex gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <div className="font-medium">Não foi possível executar a reconciliação.</div>
            <div className="text-xs mt-1 text-red-400">{error}</div>
          </div>
        </div>
      )}

      {!data && loadingSaved && !loading && (
        <div className="p-5 text-xs text-gray-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Carregando a última reconciliação persistida…</div>
      )}

      {!data && !loading && !loadingSaved && !error && (
        <div className="p-5 text-xs text-gray-500">
          Nenhum run persistido ainda. Execução manual para evitar carga desnecessária no ERP. Corte preparado: <span className="text-gray-300">{asOfDate || "—"}</span> · janela dura: <span className="text-gray-300">{inactivityMonths} meses</span>.
        </div>
      )}

      {data && (
        <div className="p-4 space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2">
            <Kpi label="Clientes ativados históricos" value={num(s.historically_activated_customers)} />
            <Kpi label="Cobertura populacional v3" value={pct(s.v3_population_coverage_pct)} sub={`${num(s.v3_population_omitted_activated)} ativados fora da coorte`} />
            <Kpi label="Churn snapshot v4" value={num(s.v4_churn_snapshot_customers)} />
            <Kpi label="Divergências conhecidas" value={num(s.known_rule_divergences)} />
            <Kpi label="Congruência classe v3 × v4" value={pct(s.churn_class_agreement_pct)} sub={`${num(s.comparable_customers)} clientes comparáveis`} />
            <Kpi label="Falso churn · contrato ativo" value={num(s.false_churn_v3_open_contract)} />
            <Kpi label="Falso churn · âncora temporal" value={num(s.false_churn_v3_temporal_anchor)} />
            <Kpi label="Ficha stale v3 em auditoria" value={num(s.stale_open_ficha_v3_requires_audit)} />
            <Kpi label="Auditoria operacional" value={num(s.v4_operational_audit_customers)} />
            <Kpi label="Divergência universo fiscal" value={num(s.fiscal_universe_divergence_customers)} sub={`${num(s.fiscal_linked_valid_documents)} vinculadas vs ${num(s.fiscal_canonical_documents)} canônicas`} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Kpi label="Taxa churn do período · candidata" value={pct(pc.period_churn_rate)} sub="motor por episódios · NÃO TRUSTED" />
            <Kpi label="Novos clientes em churn" value={num(pc.new_churn_customers)} sub={`${num(pc.new_churn_events)} evento(s) no período`} />
            <Kpi label="Base elegível no início" value={num(pc.eligible_customers_at_period_start)} sub={`${num(pc.excluded_current_operational_audit)} excluído(s) por auditoria`} />
            <Kpi label="Churns com reativação posterior" value={num(pc.historical_churns_with_later_reactivation)} sub="preservados pelo motor temporal" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="rounded-lg border border-gray-800 bg-gray-950 p-3">
              <div className="flex items-center gap-2 text-xs font-medium text-gray-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Critério para promover a v4
              </div>
              <div className="text-xs text-gray-500 mt-2">
                Amostra dirigida: <span className="text-gray-300 font-medium">{num(auditStats.total)} casos</span> · pendentes: <span className="text-amber-300 font-medium">{num(auditStats.pending)}</span> · falhas não explicadas: <span className={auditStats.fail ? "text-red-300 font-medium" : "text-emerald-300 font-medium"}>{num(auditStats.fail)}</span>.
                A v4 só pode avançar quando não houver pendências e `fail = 0`; mesmo assim, a promoção para TRUSTED continua sendo uma decisão formal separada.
              </div>
            </div>
            <div className="rounded-lg border border-gray-800 bg-gray-950 p-3">
              <div className="text-xs font-medium text-gray-300">Taxa de churn por episódios</div>
              <div className="text-xs text-gray-500 mt-2">
                <span className="text-amber-300">Candidata, ainda NÃO TRUSTED.</span> O motor une fichas sobrepostas em episódios e só cria `churn_date` quando o próximo episódio começa depois da janela de {inactivityMonths} meses. Assim um churn histórico continua existindo mesmo que o cliente seja reativado mais tarde.
              </div>
            </div>
          </div>

          {auditCases.length > 0 && (
            <div className="rounded-lg border border-emerald-900/60 overflow-hidden">
              <div className="px-3 py-3 bg-gray-950 border-b border-gray-800 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-white">Matriz de ground truth · amostra dirigida</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">Compare cada caso com o SISLOC e registre o resultado. `match` = v4 reproduz o ERP; `explained` = divergência documental/operacional explicada; `fail` = regra v4 diverge do SISLOC.</div>
                </div>
                <div className="flex gap-2 text-[11px]">
                  <span className="px-2 py-1 rounded bg-amber-950/40 text-amber-300">Pendentes {num(auditStats.pending)}</span>
                  <span className="px-2 py-1 rounded bg-emerald-950/40 text-emerald-300">Match {num(auditStats.match)}</span>
                  <span className="px-2 py-1 rounded bg-blue-950/40 text-blue-300">Explicados {num(auditStats.explained)}</span>
                  <span className="px-2 py-1 rounded bg-red-950/40 text-red-300">Fail {num(auditStats.fail)}</span>
                </div>
              </div>
              <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-gray-950 text-gray-500 uppercase">
                    <tr>
                      <th className="px-3 py-2 text-left">Caso</th>
                      <th className="px-3 py-2 text-left">Cliente</th>
                      <th className="px-3 py-2 text-left">v3</th>
                      <th className="px-3 py-2 text-left">v4</th>
                      <th className="px-3 py-2 text-left">Estado ficha</th>
                      <th className="px-3 py-2 text-right">Saldo</th>
                      <th className="px-3 py-2 text-right">Dev. pend.</th>
                      <th className="px-3 py-2 text-left">Veredito</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditCases.map((c) => (
                      <tr
                        key={c.id}
                        onClick={() => setSelectedAuditId(c.id)}
                        className={`border-t border-gray-800 cursor-pointer hover:bg-gray-800/60 ${String(selectedAuditId) === String(c.id) ? "bg-emerald-950/20" : ""}`}
                      >
                        <td className="px-3 py-2 text-gray-300 min-w-[210px]">{CASE_LABELS[c.case_type] || c.case_type}</td>
                        <td className="px-3 py-2 text-white font-medium whitespace-nowrap">{c.nm_pessoa || `#${c.cd_pessoa}`}</td>
                        <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{c.v3_status || "—"}</td>
                        <td className="px-3 py-2 text-purple-300 whitespace-nowrap">{c.v4_status || "—"}</td>
                        <td className="px-3 py-2 text-gray-300 min-w-[190px]">{c.operational_status || "—"}</td>
                        <td className="px-3 py-2 text-right text-amber-300">{num(c.physical_balance)}</td>
                        <td className="px-3 py-2 text-right text-gray-300">{num(c.pending_returns)}</td>
                        <td className={`px-3 py-2 font-medium ${c.verdict === "fail" ? "text-red-300" : c.verdict === "match" ? "text-emerald-300" : c.verdict === "explained" ? "text-blue-300" : "text-amber-300"}`}>{c.verdict || "pending"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {selectedAudit && (
            <div className="rounded-lg border border-emerald-900/50 bg-gray-950 p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-white">Homologar caso · {CASE_LABELS[selectedAudit.case_type] || selectedAudit.case_type}</div>
                  <div className="text-[11px] text-gray-500 mt-1">Cliente {selectedAudit.nm_pessoa || selectedAudit.cd_pessoa} · v4 <span className="text-purple-300">{selectedAudit.v4_status}</span> · fim real {dateBr(selectedAudit.relationship_end_date)} · churn date {dateBr(selectedAudit.churn_date)}</div>
                </div>
                <div className="text-[11px] text-gray-500">Prioridade {num(selectedAudit.priority)}</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="space-y-1">
                  <span className="text-[11px] text-gray-500">Status observado no SISLOC</span>
                  <input
                    value={reviewDraft.sisloc_observed_status}
                    onChange={(e) => setReviewDraft((d) => ({ ...d, sisloc_observed_status: e.target.value }))}
                    placeholder="Ex.: ficha aberta / encerrada / equipamento em campo"
                    className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-xs text-white"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] text-gray-500">Veredito</span>
                  <select
                    value={reviewDraft.verdict}
                    onChange={(e) => setReviewDraft((d) => ({ ...d, verdict: e.target.value }))}
                    className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-xs text-white"
                  >
                    <option value="pending">Pendente</option>
                    <option value="match">Match · v4 reproduz SISLOC</option>
                    <option value="explained">Divergência explicada</option>
                    <option value="fail">Fail · regra v4 diverge</option>
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <Kpi label="NF vinculadas" value={num(selectedAudit.valid_linked_nf_count)} />
                  <Kpi label="NF canônicas" value={num(selectedAudit.canonical_nf_count)} />
                </div>
              </div>
              <label className="space-y-1 block">
                <span className="text-[11px] text-gray-500">Evidência / justificativa</span>
                <textarea
                  value={reviewDraft.explanation}
                  onChange={(e) => setReviewDraft((d) => ({ ...d, explanation: e.target.value }))}
                  placeholder="Registre o que foi conferido no SISLOC e por que o caso é match, explicado ou fail."
                  className="w-full min-h-[76px] bg-gray-900 border border-gray-700 rounded px-3 py-2 text-xs text-white resize-y"
                />
              </label>
              <div className="flex justify-end">
                <button
                  onClick={saveReview}
                  disabled={savingReview}
                  className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-xs font-medium text-white flex items-center gap-2"
                >
                  {savingReview && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Salvar homologação do caso
                </button>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-gray-800 overflow-hidden">
            <div className="px-3 py-2 bg-gray-950 border-b border-gray-800">
              <div className="text-xs font-semibold text-white">Principais divergências v3 × v4</div>
              <div className="text-[11px] text-gray-500 mt-0.5">Clique em um cliente para ver a evidência ficha a ficha.</div>
            </div>
            <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-950 text-gray-500 uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left">Cliente</th>
                    <th className="px-3 py-2 text-left">Divergência</th>
                    <th className="px-3 py-2 text-left">v3</th>
                    <th className="px-3 py-2 text-left">v4</th>
                    <th className="px-3 py-2 text-left">Fim real</th>
                    <th className="px-3 py-2 text-left">Churn date</th>
                    <th className="px-3 py-2 text-right">Fichas ativas</th>
                    <th className="px-3 py-2 text-right">Inconsist.</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.top_divergences || []).map((r) => (
                    <tr
                      key={r.cd_pessoa}
                      onClick={() => setSelectedCustomer(r.cd_pessoa)}
                      className={`border-t border-gray-800 cursor-pointer hover:bg-gray-800/60 ${String(selectedCustomer) === String(r.cd_pessoa) ? "bg-amber-950/20" : ""}`}
                    >
                      <td className="px-3 py-2 text-white font-medium whitespace-nowrap">{r.nm_pessoa || `#${r.cd_pessoa}`}</td>
                      <td className="px-3 py-2 text-amber-300 min-w-[230px]">{LABELS[r.divergence_type] || r.divergence_type}</td>
                      <td className="px-3 py-2 text-gray-300 whitespace-nowrap">{r.v3_status}</td>
                      <td className="px-3 py-2 text-purple-300 whitespace-nowrap">{r.v4_status}</td>
                      <td className="px-3 py-2 text-gray-300 whitespace-nowrap">{dateBr(r.relationship_end_date)}</td>
                      <td className="px-3 py-2 text-gray-300 whitespace-nowrap">{dateBr(r.churn_date)}</td>
                      <td className="px-3 py-2 text-right text-gray-300">{num(r.active_operational_fichas)}</td>
                      <td className="px-3 py-2 text-right text-gray-300">{num(r.inconsistent_fichas)}</td>
                    </tr>
                  ))}
                  {(data.top_divergences || []).length === 0 && (
                    <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-600">Nenhuma divergência automática encontrada.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {selectedCustomer && (
            <div className="rounded-lg border border-gray-800 overflow-hidden">
              <div className="px-3 py-2 bg-gray-950 border-b border-gray-800 text-xs font-semibold text-white">
                Evidência das fichas · cliente {selectedCustomer}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-950 text-gray-500 uppercase">
                    <tr>
                      <th className="px-3 py-2 text-left">Ficha</th>
                      <th className="px-3 py-2 text-left">Estado operacional</th>
                      <th className="px-3 py-2 text-right">Remetido</th>
                      <th className="px-3 py-2 text-right">Devolvido</th>
                      <th className="px-3 py-2 text-right">Saldo</th>
                      <th className="px-3 py-2 text-right">Dev. pendente</th>
                      <th className="px-3 py-2 text-left">Entrada</th>
                      <th className="px-3 py-2 text-left">Encerramento</th>
                      <th className="px-3 py-2 text-left">Fim faturado</th>
                      <th className="px-3 py-2 text-left">Última NF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedEvidence.map((r) => (
                      <tr key={r.cd_controle} className="border-t border-gray-800">
                        <td className="px-3 py-2 text-white">{r.numero || r.cd_controle}</td>
                        <td className="px-3 py-2 text-purple-300 whitespace-nowrap">{r.operational_state}</td>
                        <td className="px-3 py-2 text-right text-gray-300">{num(r.qt_remetida)}</td>
                        <td className="px-3 py-2 text-right text-gray-300">{num(r.qt_devolvida_atual)}</td>
                        <td className="px-3 py-2 text-right text-amber-300">{num(r.saldo_fisico_atual)}</td>
                        <td className="px-3 py-2 text-right text-gray-300">{num(r.devolucoes_pendentes)}</td>
                        <td className="px-3 py-2 text-gray-300 whitespace-nowrap">{dateBr(r.last_dt_entrada)}</td>
                        <td className="px-3 py-2 text-gray-300 whitespace-nowrap">{dateBr(r.dt_enc_ficha)}</td>
                        <td className="px-3 py-2 text-gray-300 whitespace-nowrap">{dateBr(r.last_fatura_fim)}</td>
                        <td className="px-3 py-2 text-gray-300 whitespace-nowrap">{dateBr(r.last_valid_nf)}</td>
                      </tr>
                    ))}
                    {selectedEvidence.length === 0 && (
                      <tr><td colSpan={10} className="px-3 py-6 text-center text-gray-600">Detalhe não carregado para este cliente (limite de amostra do painel).</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
