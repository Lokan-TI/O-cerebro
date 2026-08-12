// Monta um contexto compacto do snapshot para o consultor (LLM)
export function buildBrainContext(snapshot, sourceName) {
  if (!snapshot) return null;
  const pick = (arr, n) => (Array.isArray(arr) ? arr.slice(0, n) : []);
  return JSON.stringify({
    fonte: sourceName || snapshot.source_name,
    dados_ate: snapshot.max_date,
    kpis: snapshot.kpis || {},
    por_empresa: pick(snapshot.by_empresa, 12),
    evolucao_anual: pick(snapshot.annual_evolution, 6),
    receita_mensal_recente: pick(
      (snapshot.monthly_revenue || []).slice(-18),
      18
    ),
    top_clientes: pick(snapshot.top_clients, 10),
    top_vendedores: pick(snapshot.top_vendors, 10),
    alertas: pick(snapshot.alerts, 10),
  });
}

export const SUGGESTED_QUESTIONS = [
  "Como está a saúde geral do negócio?",
  "Qual empresa mais cresceu e qual preocupa?",
  "Onde estou perdendo clientes (churn)?",
  "Quais clientes merecem atenção imediata?",
  "O que devo priorizar neste trimestre?",
];