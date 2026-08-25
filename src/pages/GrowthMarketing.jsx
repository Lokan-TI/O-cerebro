import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useErpSource, ALL_SOURCES_ID } from "@/lib/ErpSourceContext";
import { useBrainSnapshot } from "@/components/brain/useBrainSnapshot";
import { useGlobalFilter } from "@/lib/GlobalFilterContext";
import { buildGrowthKpis } from "@/lib/growthKpis";
import DecisionSection from "@/components/decision/DecisionSection";
import QueryInspector from "@/components/erp/QueryInspector";
import TabChurn from "@/components/erp/TabChurn";
import ConversaoNovosClientes from "./ConversaoNovosClientes";
import ConversasLeads from "./ConversasLeads";
import {
  AlertTriangle,
  ArrowRight,
  HeartPulse,
  Loader2,
  RefreshCw,
  Repeat2,
  Rocket,
  Target,
  UserRoundSearch,
  UsersRound,
} from "lucide-react";

const TABS = [
  { id: "overview", label: "Visão Geral", icon: Rocket },
  { id: "aquisicao", label: "Aquisição", icon: UserRoundSearch },
  { id: "conversao", label: "Conversão", icon: Target },
  { id: "churn", label: "Retenção & Churn", icon: Repeat2 },
  { id: "reativacao", label: "Reativação de Carteira", icon: UsersRound },
  { id: "health", label: "Customer Health", icon: HeartPulse },
];

function minusMonths(iso, months) {
  const d = new Date(`${iso}T00:00:00`);
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

function churnWindows(period, months = 13) {
  const analysisEnd = period.endExclusive;
  const analysisStart = minusMonths(analysisEnd, months);
  return {
    ref_start: minusMonths(analysisStart, months),
    ref_end: analysisStart,
    analysis_start: analysisStart,
    analysis_end: analysisEnd,
    inactivity_months: months,
  };
}

const brl = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const num = (v) => Number(v || 0).toLocaleString("pt-BR");
const dateBr = (v) => v ? new Date(`${v}T00:00:00`).toLocaleDateString("pt-BR") : "—";

function Overview({ growth, loading, error, dept, load, selectedSource }) {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Visão Geral de Growth</h2>
          <p className="text-sm text-gray-500 mt-1">
            Demanda, ativação, eficiência da frota e receita apuradas diretamente no SISLOC
            {selectedSource?.name ? ` · base ${selectedSource.name}` : ""}.
          </p>
          {growth?.period && <p className="text-xs text-gray-500 mt-1">Janela: {growth.period.start} a {growth.period.end}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {growth?.queries && <QueryInspector queries={growth.queries} />}
          <button onClick={load} disabled={loading} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm rounded-lg px-4 py-2">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Atualizar do ERP
          </button>
        </div>
      </div>
      {error && <div className="border border-red-700/50 bg-red-950/30 rounded-xl p-4 text-sm text-red-300 flex gap-2"><AlertTriangle className="w-4 h-4 mt-0.5" />{error}</div>}
      {growth?.warnings?.length > 0 && <div className="border border-amber-700/50 bg-amber-950/20 rounded-xl p-4 text-xs text-amber-300">Ressalvas da consulta: {growth.warnings.join(" · ")}</div>}
      {loading && !growth ? (
        <div className="flex items-center gap-2 text-gray-500 text-sm py-16"><Loader2 className="w-4 h-4 animate-spin" /> Apurando indicadores no ERP…</div>
      ) : !dept ? (
        <p className="text-gray-500 text-sm py-16">Nenhum dado disponível. Use “Atualizar do ERP”.</p>
      ) : <DecisionSection dept={dept} editing={false} hiddenIds={[]} onToggle={() => {}} />}
    </div>
  );
}

function PortfolioPanel({ mode, data, loading, error, onRefresh, onOpenChurn }) {
  const isHealth = mode === "health";
  const wanted = isHealth
    ? ["MONITORAR", "PRE_CHURN", "ATIVO_CONTRATO_ALERTA", "AUDITAR_SEM_NF"]
    : ["PRE_CHURN", "CHURN_CONFIRMADO"];
  const rows = (data?.growth_clients || []).filter((r) => wanted.includes(r.growth_status));
  const summary = data?.summary || {};

  const cards = isHealth ? [
    ["Monitorar", summary.monitor_clients],
    ["Pré-churn", summary.pre_churn_clients],
    ["Ficha aberta com alerta", summary.open_contract_billing_alerts],
    ["Auditar sem NF", summary.audit_without_nf],
  ] : [
    ["Carteira de reativação", summary.reactivation_clients],
    ["Pré-churn", summary.pre_churn_clients],
    ["Churn confirmado", summary.churned_clients],
    ["Receita em risco", brl(summary.revenue_at_risk), true],
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4 bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div>
          <div className="flex items-center gap-2">
            {isHealth ? <HeartPulse className="w-5 h-5 text-cyan-400" /> : <UsersRound className="w-5 h-5 text-emerald-400" />}
            <h2 className="text-lg font-semibold text-white">{isHealth ? "Customer Health" : "Reativação de Carteira"}</h2>
          </div>
          <p className="text-sm text-gray-400 mt-1">
            {isHealth
              ? "Sinais acionáveis do churn v3 antes da perda: monitoramento, pré-churn, anomalia de faturamento e auditoria."
              : "Fila real de clientes em pré-churn e churn confirmado, derivada da regra ficha aberta → última NF válida → 13 meses."}
          </p>
          {data?.source?.name && <p className="text-xs text-gray-500 mt-1">Fonte resolvida: {data.source.name}</p>}
        </div>
        <div className="flex gap-2">
          <button onClick={onRefresh} disabled={loading} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Atualizar carteira
          </button>
          <button onClick={onOpenChurn} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-sm">
            Ver regra completa <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && <div className="bg-red-950/30 border border-red-800 rounded-xl p-4 text-sm text-red-300">{error}</div>}
      {loading && !data && <div className="py-12 text-gray-500 text-sm flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Consultando carteira no ERP…</div>}

      {data && (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            {cards.map(([label, value, formatted]) => (
              <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
                <div className="text-2xl font-bold text-white mt-1">{formatted ? value : num(value)}</div>
              </div>
            ))}
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-white">{isHealth ? "Clientes que exigem atenção" : "Fila acionável de reativação"}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{rows.length} clientes nesta visão</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-950 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="text-left px-4 py-2">Cliente</th>
                    <th className="text-left px-4 py-2">Status</th>
                    <th className="text-right px-4 py-2">Receita ref.</th>
                    <th className="text-left px-4 py-2">Última NF</th>
                    <th className="text-right px-4 py-2">Dias sem NF</th>
                    <th className="text-left px-4 py-2">Ficha</th>
                    <th className="text-left px-4 py-2">Contato</th>
                    <th className="text-left px-4 py-2">Cidade</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 250).map((r) => (
                    <tr key={`${r.cd_pessoa}-${r.growth_status}`} className="border-t border-gray-800">
                      <td className="px-4 py-2 text-white font-medium">{r.nm_pessoa || r.cd_pessoa}</td>
                      <td className="px-4 py-2 text-purple-300">{r.growth_status}</td>
                      <td className="px-4 py-2 text-right text-gray-200">{brl(r.ref_revenue)}</td>
                      <td className="px-4 py-2 text-gray-300">{dateBr(r.last_rental_nf)}</td>
                      <td className="px-4 py-2 text-right text-amber-300">{r.days_since_last_activity ?? "—"}</td>
                      <td className="px-4 py-2 text-gray-300">{r.fichas_abertas > 0 ? `${r.fichas_abertas} aberta(s)` : "Encerrada"}</td>
                      <td className="px-4 py-2 text-gray-300">{r.telefone || r.en_mail_pessoa || "—"}</td>
                      <td className="px-4 py-2 text-gray-300">{[r.cidade_pessoa, r.uf_pessoa].filter(Boolean).join(" / ") || "—"}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-600">Nenhum cliente enquadrado nesta fila para a janela atual.</td></tr>}
                </tbody>
              </table>
            </div>
            {rows.length > 250 && <div className="px-4 py-2 border-t border-gray-800 text-xs text-gray-500">Mostrando 250 de {rows.length} clientes.</div>}
          </div>
        </>
      )}
    </div>
  );
}

export default function GrowthMarketing() {
  const location = useLocation();
  const navigate = useNavigate();
  const { selectedSource } = useErpSource();
  const { period } = useGlobalFilter();
  const { snapshot } = useBrainSnapshot();
  const [growth, setGrowth] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [churnData, setChurnData] = useState(null);
  const [churnLoading, setChurnLoading] = useState(false);
  const [churnError, setChurnError] = useState(null);

  const requestedTab = new URLSearchParams(location.search).get("tab") || "overview";
  const activeTab = TABS.some((t) => t.id === requestedTab) ? requestedTab : "overview";
  const setTab = useCallback((tab) => navigate(`/GrowthMarketing?tab=${tab}`), [navigate]);
  const sourceId = selectedSource?.id && selectedSource.id !== ALL_SOURCES_ID ? selectedSource.id : undefined;

  const loadGrowth = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await base44.functions.invoke("analyzeGrowth", {
        ...(sourceId ? { source_id: sourceId } : {}),
        start_date: period.start,
        end_date: period.end,
        end_date_exclusive: period.endExclusive,
      });
      const result = res?.data || res;
      if (result?.error) setError(result.error); else setGrowth(result);
    } catch (e) {
      setError("Não foi possível consultar o ERP agora. Detalhe: " + String(e?.message || e).slice(0, 220));
    } finally { setLoading(false); }
  }, [sourceId, period.start, period.end, period.endExclusive]);

  const loadChurn = useCallback(async () => {
    setChurnLoading(true); setChurnError(null);
    try {
      const res = await base44.functions.invoke("analyzeClientChurn", {
        source_id: selectedSource?.id,
        ...churnWindows(period, 13),
      });
      const result = res?.data || res;
      if (result?.success) setChurnData(result); else setChurnError(result?.error || "Falha ao consultar a carteira.");
    } catch (e) {
      setChurnError(String(e?.message || e));
    } finally { setChurnLoading(false); }
  }, [selectedSource?.id, period.start, period.endExclusive]);

  useEffect(() => { if (activeTab === "overview") loadGrowth(); }, [activeTab, loadGrowth]);
  useEffect(() => {
    if (["reativacao", "health"].includes(activeTab)) loadChurn();
  }, [activeTab, loadChurn]);

  const dept = useMemo(() => buildGrowthKpis(growth, snapshot), [growth, snapshot]);

  return (
    <div className="min-h-screen bg-gray-950 px-6 py-8">
      <div className="max-w-[1600px] mx-auto">
        <div className="mb-5 pr-14">
          <div className="flex items-center gap-2"><Rocket className="w-5 h-5 text-purple-400" /><h1 className="text-2xl font-bold text-white">Growth Marketing</h1></div>
          <p className="text-sm text-gray-500 mt-1">Jornada integrada de aquisição, conversão, retenção, reativação e saúde da carteira.</p>
        </div>

        <div className="flex flex-wrap gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 mb-6 w-fit max-w-full">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = tab.id === activeTab;
            return <button key={tab.id} onClick={() => setTab(tab.id)} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${active ? "bg-purple-600 text-white" : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"}`}><Icon className="w-4 h-4" /> {tab.label}</button>;
          })}
        </div>

        {activeTab === "overview" && <Overview growth={growth} loading={loading} error={error} dept={dept} load={loadGrowth} selectedSource={selectedSource} />}
        {activeTab === "aquisicao" && <ConversasLeads />}
        {activeTab === "conversao" && <ConversaoNovosClientes />}
        {activeTab === "churn" && <TabChurn />}
        {activeTab === "reativacao" && <PortfolioPanel mode="reactivation" data={churnData} loading={churnLoading} error={churnError} onRefresh={loadChurn} onOpenChurn={() => setTab("churn")} />}
        {activeTab === "health" && <PortfolioPanel mode="health" data={churnData} loading={churnLoading} error={churnError} onRefresh={loadChurn} onOpenChurn={() => setTab("churn")} />}
      </div>
    </div>
  );
}
