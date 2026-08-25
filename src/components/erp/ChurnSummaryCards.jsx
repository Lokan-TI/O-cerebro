import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useErpSource } from "@/lib/ErpSourceContext";
import AnalyticsKpiCard from "./AnalyticsKpiCard";
import { Settings2, Plus, X, RefreshCw } from "lucide-react";

const STORAGE_KEY = "churn_card_configs";

const AVAILABLE_METRICS = [
  { key: "total_ref_clients", label: "Base de Referência", format: "number" },
  { key: "active_clients", label: "Clientes Ativos", format: "number" },
  { key: "churned_clients", label: "Clientes Perdidos", format: "number" },
  { key: "churn_rate", label: "Taxa de Churn", format: "percent" },
  { key: "revenue_at_risk", label: "Receita em Risco", format: "currency" },
  { key: "active_revenue", label: "Receita Retida", format: "currency" },
  { key: "avg_churned_revenue", label: "Receita Média (Perdidos)", format: "currency" },
  { key: "retained_by_contract", label: "Retidos por contrato ativo", format: "number" },
  { key: "open_contract_clients", label: "Com contrato em aberto", format: "number" },
];

const DEFAULT_CARDS = [
  { id: "c1", type: "metric", metric: "churned_clients", label: "Clientes Perdidos", format: "number", accent: "red" },
  { id: "c2", type: "metric", metric: "churn_rate", label: "Taxa de Churn", format: "percent", accent: "orange" },
  { id: "c3", type: "metric", metric: "revenue_at_risk", label: "Receita em Risco", format: "currency", accent: "red" },
  { id: "c4", type: "metric", metric: "active_clients", label: "Clientes Ativos", format: "number", accent: "green" },
  { id: "c5", type: "metric", metric: "total_ref_clients", label: "Base de Referência", format: "number", accent: "blue" },
  { id: "c6", type: "metric", metric: "active_revenue", label: "Receita Retida", format: "currency", accent: "emerald" },
];

const ACCENTS = ["blue", "purple", "green", "yellow", "red", "cyan", "emerald", "orange", "indigo"];

export default function ChurnSummaryCards({ summary }) {
  const { selectedSource } = useErpSource();
  const [cards, setCards] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : DEFAULT_CARDS;
    } catch {
      return DEFAULT_CARDS;
    }
  });
  const [editMode, setEditMode] = useState(false);
  const [sqlStates, setSqlStates] = useState({});

  const saveCards = useCallback((newCards) => {
    setCards(newCards);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newCards));
  }, []);

  const runSqlCard = useCallback(async (cardId, sql) => {
    if (!selectedSource || !sql) return;
    setSqlStates(prev => ({ ...prev, [cardId]: { loading: true } }));
    try {
      const res = await base44.functions.invoke("sqlServerQuery", {
        source_id: selectedSource.id,
        query: sql,
      });
      const rows = res?.data?.rows || res?.rows || [];
      const value = rows.length > 0 ? Object.values(rows[0])[0] : null;
      setSqlStates(prev => ({ ...prev, [cardId]: { value, loading: false } }));
    } catch (err) {
      setSqlStates(prev => ({ ...prev, [cardId]: { error: err.message || String(err), loading: false } }));
    }
  }, [selectedSource]);

  // Run SQL cards on mount and when source changes
  useEffect(() => {
    for (const card of cards) {
      if (card.type === "sql" && card.sql && !sqlStates[card.id]) {
        runSqlCard(card.id, card.sql);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, selectedSource]);

  const updateCard = (id, changes) => {
    if (changes.sql !== undefined) {
      setSqlStates(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
    saveCards(cards.map(c => c.id === id ? { ...c, ...changes } : c));
  };

  const addCard = (type) => {
    const newCard = type === "metric"
      ? { id: `c${Date.now()}`, type: "metric", metric: "total_ref_clients", label: "Nova Métrica", format: "number", accent: "blue" }
      : { id: `c${Date.now()}`, type: "sql", sql: "", label: "SQL Personalizado", format: "number", accent: "cyan" };
    saveCards([...cards, newCard]);
  };

  const removeCard = (id) => {
    saveCards(cards.filter(c => c.id !== id));
    setSqlStates(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const getCardValue = (card) => {
    if (card.type === "metric") {
      return summary?.[card.metric] ?? null;
    }
    const state = sqlStates[card.id];
    return state?.value ?? null;
  };

  const getCardSub = (card) => {
    if (card.type === "sql") {
      const state = sqlStates[card.id];
      if (state?.loading) return "Carregando...";
      if (state?.error) return "Erro na query";
      return "SQL personalizado";
    }
    return undefined;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-semibold text-sm">Indicadores de Churn</h3>
        <div className="flex gap-2">
          {editMode && (
            <button
              onClick={() => { saveCards(DEFAULT_CARDS); setSqlStates({}); }}
              className="px-3 py-1.5 text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
            >
              Restaurar padrão
            </button>
          )}
          <button
            onClick={() => setEditMode(!editMode)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              editMode ? "bg-purple-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            <Settings2 className="w-3.5 h-3.5" />
            {editMode ? "Concluir edição" : "Editar cards"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {cards.map(card => (
          <div key={card.id} className="relative">
            {editMode && (
              <button
                onClick={() => removeCard(card.id)}
                className="absolute -top-2 -right-2 z-10 w-5 h-5 bg-red-600 hover:bg-red-500 text-white rounded-full flex items-center justify-center"
              >
                <X className="w-3 h-3" />
              </button>
            )}
            {editMode ? (
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 space-y-2">
                <input
                  type="text"
                  value={card.label}
                  onChange={e => updateCard(card.id, { label: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white"
                  placeholder="Título do card"
                />
                {card.type === "metric" ? (
                  <select
                    value={card.metric}
                    onChange={e => {
                      const m = AVAILABLE_METRICS.find(m => m.key === e.target.value);
                      updateCard(card.id, { metric: e.target.value, format: m?.format || "number" });
                    }}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white"
                  >
                    {AVAILABLE_METRICS.map(m => (
                      <option key={m.key} value={m.key}>{m.label}</option>
                    ))}
                  </select>
                ) : (
                  <div>
                    <textarea
                      value={card.sql}
                      onChange={e => updateCard(card.id, { sql: e.target.value })}
                      placeholder={"SELECT COUNT(*) AS valor FROM nf WHERE dt_emi_nf >= '2025-01-01' AND ..."}
                      className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white font-mono h-20 resize-none"
                    />
                    <button
                      onClick={() => runSqlCard(card.id, card.sql)}
                      className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 mt-1"
                    >
                      <RefreshCw className="w-3 h-3" /> Executar SQL
                    </button>
                  </div>
                )}
                <div className="flex gap-1">
                  <select
                    value={card.format}
                    onChange={e => updateCard(card.id, { format: e.target.value })}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white"
                  >
                    <option value="number">Número</option>
                    <option value="currency">Moeda</option>
                    <option value="percent">Percentual</option>
                  </select>
                  <select
                    value={card.accent}
                    onChange={e => updateCard(card.id, { accent: e.target.value })}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white"
                  >
                    {ACCENTS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              </div>
            ) : (
              <AnalyticsKpiCard
                label={card.label}
                value={getCardValue(card)}
                format={card.format}
                accent={card.accent}
                sub={getCardSub(card)}
              />
            )}
          </div>
        ))}
        {editMode && (
          <div className="flex flex-col gap-2">
            <button
              onClick={() => addCard("metric")}
              className="flex-1 flex items-center justify-center gap-1.5 bg-gray-900 border-2 border-dashed border-gray-700 hover:border-purple-500 rounded-lg p-4 text-gray-500 hover:text-purple-400 text-xs transition-colors"
            >
              <Plus className="w-4 h-4" /> Métrica
            </button>
            <button
              onClick={() => addCard("sql")}
              className="flex-1 flex items-center justify-center gap-1.5 bg-gray-900 border-2 border-dashed border-gray-700 hover:border-cyan-500 rounded-lg p-4 text-gray-500 hover:text-cyan-400 text-xs transition-colors"
            >
              <Plus className="w-4 h-4" /> SQL
            </button>
          </div>
        )}
      </div>
    </div>
  );
}