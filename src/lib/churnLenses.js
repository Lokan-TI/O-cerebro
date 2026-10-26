// Definições oficiais das três óticas de churn exibidas no app (F6).
// Espelhadas em kpis.churn_definitions do snapshot (refreshErpData).
export const CHURN_LENSES = {
  v4: {
    tag: "Ótica V4 · episódios",
    definition: "Clientes elegíveis com episódios encerrados por inatividade acima de 13 meses (regra oficial de churn).",
  },
  churn12: {
    tag: "Ótica churn12 · rolling",
    definition: "Base dos últimos 12 meses vs ativos últimos 12 meses (rolling).",
  },
  annual_ytd: {
    tag: "Ótica anual YTD",
    definition: "Clientes que faturaram no ano anterior (mesma janela YTD) e ainda não faturaram neste.",
  },
};