import { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { AlertTriangle, CheckCircle2, FlaskConical, Loader2, RefreshCw } from "lucide-react";

const num = (v) => Number(v || 0).toLocaleString("pt-BR");
const pct = (v) => `${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%`;
const dateBr = (v) => v ? new Date(`${String(v).slice(0, 10)}T00:00:00`).toLocaleDateString("pt-BR") : "—";

const LABELS = {
  POPULACAO_V3_OMITE_CLIENTE_ATIVADO: "Cliente ativado fora da coorte v3",
  V4_ATIVO_COM_INCONSISTENCIA: "Ativo com inconsistência operacional",
  AUDITORIA_OPERACIONAL_V4: "Auditoria operacional v4",
  FALSO_CHURN_V3_CONTRATO_ATIVO: "Falso churn v3 · contrato ativo",
  FALSO_CHURN_V3_ANCORA_TEMPORAL: "Falso churn v3 · âncora temporal",
  CHURN_OCULTO_V3_FICHA_ABERTA_STALE: "Churn oculto v3 · ficha stale",
  UNIVERSO_FISCAL_V3_EXCLUI_NF_VINCULADA: "NF vinculada fora do universo fiscal v3",
  SEM_DIVERGENCIA_REGRA: "Sem divergência de regra",
};

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

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
        detail_limit: 50,
        include_details: true,
      });
      const result = res?.data || res;
      if (!result?.success) throw new Error(result?.error || "Falha na reconciliação v4.");
      setData(result);
      setSelectedCustomer(result?.top_divergences?.[0]?.cd_pessoa || null);
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

      {!data && !loading && !error && (
        <div className="p-5 text-xs text-gray-500">
          Execução manual para evitar carga desnecessária no ERP. Corte preparado: <span className="text-gray-300">{asOfDate || "—"}</span> · janela dura: <span className="text-gray-300">{inactivityMonths} meses</span>.
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
            <Kpi label="Churn oculto por ficha stale" value={num(s.hidden_churn_v3_stale_open_ficha)} />
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
                Divergências não explicadas contra o SISLOC: <span className="text-amber-300 font-medium">ainda não medidas</span>. O painel já explica divergências v3 × v4, mas a homologação final continua dependendo da amostra dirigida no ERP.
              </div>
            </div>
            <div className="rounded-lg border border-gray-800 bg-gray-950 p-3">
              <div className="text-xs font-medium text-gray-300">Taxa de churn por episódios</div>
              <div className="text-xs text-gray-500 mt-2">
                <span className="text-amber-300">Candidata, ainda NÃO TRUSTED.</span> O motor une fichas sobrepostas em episódios e só cria `churn_date` quando o próximo episódio começa depois da janela de {inactivityMonths} meses. Assim um churn histórico continua existindo mesmo que o cliente seja reativado mais tarde.
              </div>
            </div>
          </div>

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
