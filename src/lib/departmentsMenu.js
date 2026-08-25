// Menu de dados organizado por departamento
export const DEPARTMENTS = [
  {
    id: "decisao",
    label: "Painel de Decisão",
    items: [
      { label: "KPIs por departamento (inclui Growth)", to: "/PainelDecisao" },
      { label: "Previsibilidade de receita (10 anos)", to: "/ProjecaoLongoPrazo" },
      { label: "Ativos, CAPEX e OPEX", to: "/AtivosCustos" },
    ],
  },
  {
    id: "cerebro",
    label: "Cérebro",
    items: [{ label: "Consultor IA", to: "/" }],
  },
  {
    id: "growth",
    label: "Growth Marketing",
    items: [
      { label: "Painel de Growth", to: "/GrowthMarketing" },
      { label: "Conversão de Novos Clientes", to: "/ConversaoNovosClientes" },
      { label: "Leads RD Conversas (WhatsApp/Instagram)", to: "/ConversasLeads" },
    ],
  },
  {
    id: "comercial",
    label: "Comercial",
    items: [
      { label: "Visão Executiva", to: "/ErpCrmDashboard?tab=executiva" },
      { label: "Clientes", to: "/ErpCrmDashboard?tab=clientes_pessoa" },
      { label: "Cliente 360", to: "/ErpCrmDashboard?tab=cliente360" },
      { label: "Classificação", to: "/ErpCrmDashboard?tab=classificacao" },
      { label: "Retenção & Churn", to: "/ErpCrmDashboard?tab=churn" },
      { label: "Locações", to: "/ErpCrmDashboard?tab=locacoes" },
      { label: "Clientes CAR", to: "/ErpCrmDashboard?tab=car" },
    ],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    items: [
      { label: "DRE, balancete e ralos financeiros", to: "/DetalhamentoFinanceiro" },
      { label: "Financeiro (CAR/CAP)", to: "/ErpCrmDashboard?tab=financeiro" },
    ],
  },
  {
    id: "fiscal",
    label: "Fiscal",
    items: [{ label: "Notas fiscais", soon: true }],
  },
  {
    id: "logistica",
    label: "Logística",
    items: [{ label: "Operacional", to: "/ErpCrmDashboard?tab=operacional" }],
  },
  {
    id: "manutencao",
    label: "Manutenção",
    items: [{ label: "Frota e manutenções", soon: true }],
  },
  {
    id: "config",
    label: "Configuração de dados",
    items: [
      { label: "Gerenciar fontes", to: "/GerenciarFontes" },
      { label: "Integrações (CRM / ERP API)", to: "/Integracoes" },
      { label: "Estrutura do banco", to: "/ErpCrmDashboard?tab=estrutura" },
    ],
  },
  {
    id: "sql",
    label: "Querys SQL",
    items: [{ label: "Executar query", to: "/ErpCrmDashboard?tab=query" }],
  },
];