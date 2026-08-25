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
  Activity,
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
          {growth?.period && (
            <p className="text-xs text-gray-500 mt-1">Janela: {growth.period.start} a {growth.period.end}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {growth?.queries && <QueryInspector queries={growth.queries} />}
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm rounded-lg px-4 py-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Atualizar do ERP
          </button>
        </div>
      </div>

      {error && (
        <div className="border border-red-700/50 bg-red-950/30 rounded-xl p-4 text-sm text-red-300 flex gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {growth?.warnings?.length > 0 && (
        <div className="border border-amber-700/50 bg-amber-950/20 rounded-xl p-4 text-xs text-amber-300">
          Alguns indicadores não puderam ser apurados nesta consulta: {growth.warnings.join(" · ")}
        </div>
      )}

      {loading && !growth ? (
        <div className="flex items-center gap-2 text-gray-500 text-sm py-16">
          <Loader2 className="w-4 h-4 animate-spin" /> Apurando indicadores no ERP…
        </div>
      ) : !dept ? (
        <p className="text-gray-500 text-sm py-16">Nenhum dado disponível. Use “Atualizar do ERP” para apurar os indicadores.</p>
      ) : (
        <DecisionSection dept={dept} editing={false} hiddenIds={[]} onToggle={() => {}} />
      )}
    </div>
  );
}

function StrategyPanel({ type, onOpenChurn }) {
  const isHealth = type === "health";
  return (
    <div className="space-y-5">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-2">
          {isHealth ? <HeartPulse className="w-5 h-5 text-cyan-400" /> : <UsersRound className="w-5 h-5 text-emerald-400" />}
          <h2 className="text-lg font-semibold text-white">
            {isHealth ? "Customer Health" : "Reativação de Carteira"}
          </h2>
        </div>
        <p className="text-sm text-gray-400 leading-relaxed max-w-4xl">
          {isHealth
            ? "Camada de prevenção: transforma sinais de contrato, faturamento e recorrência em prioridade de relacionamento antes do churn confirmado."
            : "Camada operacional para transformar pré-churn e churn confirmado em fila acionável de recuperação comercial, sem misturar clientes que ainda possuem ficha de locação ativa."}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {(isHealth
          ? [
              ["Contrato", "Ficha aberta é o sinal dominante. Cliente com locação efetiva em andamento não entra em churn."],
              ["Recência fiscal", "Quando todas as fichas estão encerradas, usamos a última NF válida da locação como relógio oficial."],
              ["Cadência", "Próxima evolução: comparar a recência atual com a frequência histórica individual de cada cliente."],
            ]
          : [
              ["Pré-churn", "Clientes sem ficha aberta que se aproximam da janela de 13 meses devem entrar em abordagem preventiva."],
              ["Churn confirmado", "Clientes com todas as fichas encerradas e última NF válida além da janela formam a carteira de win-back."],
              ["Prioridade", "A próxima camada deve ordenar a carteira por receita histórica, recência, sazonalidade e probabilidade de recompra."],
            ]
        ).map(([title, text]) => (
          <div key={title} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="text-sm font-semibold text-white mb-1">{title}</div>
            <p className="text-xs text-gray-500 leading-relaxed">{text}</p>
          </div>
        ))}
      </div>

      <div className="bg-purple-950/20 border border-purple-900/50 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-purple-200">Fonte oficial atual</div>
          <p className="text-xs text-gray-400 mt-1">
            A segmentação operacional já nasce do Churn v3: ficha aberta primeiro → última NF válida depois → janela de 13 meses por último.
          </p>
        </div>
        <button
          onClick={onOpenChurn}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium"
        >
          Abrir Retenção & Churn <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Activity className="w-4 h-4 text-amber-400" /> Próxima camada de dados
        </div>
        <p className="text-xs text-gray-500 mt-2 leading-relaxed">
          {isHealth
            ? "O Health Score ainda não será inventado com pesos arbitrários. Primeiro vamos homologar cadência histórica, sazonalidade, receita, contratos ativos e atraso de faturamento; depois versionamos um score auditável de 0–100."
            : "A fila de reativação será criada a partir de PRE_CHURN e CHURN_CONFIRMADO, com ranking por valor histórico, tempo sem NF, sazonalidade e última família de equipamento locada. A arquitetura já está preparada para essa evolução."}
        </p>
      </div>
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

  const requestedTab = new URLSearchParams(location.search).get("tab") || "overview";
  const activeTab = TABS.some((t) => t.id === requestedTab) ? requestedTab : "overview";

  const setTab = useCallback((tab) => {
    navigate(`/GrowthMarketing?tab=${tab}`);
  }, [navigate]);

  const sourceId = selectedSource?.id && selectedSource.id !== ALL_SOURCES_ID ? selectedSource.id : undefined;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("analyzeGrowth", {
        ...(sourceId ? { source_id: sourceId } : {}),
        start_date: period.start,
        end_date: period.end,
        end_date_exclusive: period.endExclusive,
      });
      if (res.data?.error) setError(res.data.error);
      else setGrowth(res.data);
    } catch (e) {
      setError("Não foi possível consultar o ERP agora. Detalhe: " + String(e?.message || e).slice(0, 200));
    } finally {
      setLoading(false);
    }
  }, [sourceId, period.start, period.end, period.endExclusive]);

  useEffect(() => {
    if (activeTab === "overview") load();
  }, [activeTab, load]);

  const dept = useMemo(() => buildGrowthKpis(growth, snapshot), [growth, snapshot]);

  return (
    <div className="min-h-screen bg-gray-950 px-6 py-8">
      <div className="max-w-[1600px] mx-auto">
        <div className="mb-5 pr-14">
          <div className="flex items-center gap-2">
            <Rocket className="w-5 h-5 text-purple-400" />
            <h1 className="text-2xl font-bold text-white">Growth Marketing</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Jornada integrada de aquisição, conversão, retenção, reativação e saúde da carteira.
          </p>
        </div>

        <div className="flex flex-wrap gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 mb-6 w-fit max-w-full">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                onClick={() => setTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  active ? "bg-purple-600 text-white" : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
                }`}
              >
                <Icon className="w-4 h-4" /> {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === "overview" && (
          <Overview growth={growth} loading={loading} error={error} dept={dept} load={load} selectedSource={selectedSource} />
        )}
        {activeTab === "aquisicao" && <ConversasLeads />}
        {activeTab === "conversao" && <ConversaoNovosClientes />}
        {activeTab === "churn" && <TabChurn />}
        {activeTab === "reativacao" && <StrategyPanel type="reativacao" onOpenChurn={() => setTab("churn")} />}
        {activeTab === "health" && <StrategyPanel type="health" onOpenChurn={() => setTab("churn")} />}
      </div>
    </div>
  );
}
