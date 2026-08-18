// Constrói os KPIs de decisão por departamento a partir do snapshot ERP,
// comparando cada indicador com o benchmark do setor de locação de equipamentos.

const brl = (v) =>
  `R$ ${Number(v || 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
const pct = (v) => `${Number(v || 0).toFixed(1)}%`;
const num = (v) => Number(v || 0).toLocaleString("pt-BR");

// direction: "up" = maior é melhor | "down" = menor é melhor
function status(value, { good, warn, direction }) {
  if (value == null || Number.isNaN(value)) return "neutral";
  if (direction === "down") {
    if (value <= good) return "good";
    return value <= warn ? "warn" : "bad";
  }
  if (value >= good) return "good";
  return value >= warn ? "warn" : "bad";
}

export function buildDecisionKpis(snapshot) {
  if (!snapshot) return [];
  const k = snapshot.kpis || {};
  const a = snapshot.analytics?.kpis || {};
  const ops = snapshot.analytics?.est_mov_by_operacao || [];
  const opQtd = (match) =>
    ops.filter((o) => (o.ds_movoperacao || "").toLowerCase().includes(match))
      .reduce((s, o) => s + (o.qtd || 0), 0);

  const carVencidoPct = a.car_total ? (a.car_vencido / a.car_total) * 100 : null;
  // CAP: o compromisso firme é o aberto sem o provisório (fl_status_titulo = 5),
  // e o total já exclui os títulos cancelados (fl_status_titulo = 40).
  const capFirme = a.cap_aberto_firme != null
    ? a.cap_aberto_firme
    : (a.cap_aberto || 0) - (a.cap_provisorio || 0);
  const capAbertoPct = a.cap_total ? (capFirme / a.cap_total) * 100 : null;
  const capVencidoPct = a.cap_total ? ((a.cap_vencido || 0) / a.cap_total) * 100 : null;
  const fatTotal = k.fat_ano || 0;
  const novosPct = fatTotal ? ((k.new_client_revenue || 0) / fatTotal) * 100 : null;
  const contratosAtivosPct = a.fichloc_total
    ? (a.fichloc_ativas / a.fichloc_total) * 100
    : null;
  const remessas = opQtd("remessa (realizada)");
  const devolucoes = opQtd("devolução (requisitada)");
  const inspecoes = opQtd("inspeção");
  const inspPorRemessa = remessas ? inspecoes / remessas : null;
  const baseAtivos = a.fichloc_clientes_ativos || 0;
  const penetracao = a.pessoa_total ? (baseAtivos / a.pessoa_total) * 100 : null;

  return [
    {
      id: "comercial",
      label: "Comercial",
      kpis: [
        {
          id: "fat_ano", label: "Faturamento no ano", value: brl(k.fat_ano),
          sub: `Ano anterior ${brl(k.fat_ano_ant)}`,
          market: "Setor cresce 10–15% a.a. (Mills, Armac, Casa do Construtor)",
          status: status(k.crescimento_ano, { good: 15, warn: 5, direction: "up" }),
          note: `Crescimento ${pct(k.crescimento_ano)}`,
        },
        {
          id: "ticket", label: "Ticket médio", value: brl(k.ticket_ano),
          sub: `${num(k.nfs_ano)} notas no ano`,
          market: "Ticket saudável cresce acima da inflação ano a ano",
          status: status(k.ticket_ano - (k.ticket_mes || 0), { good: 0, warn: -500, direction: "up" }),
          note: `Mês atual ${brl(k.ticket_mes)}`,
        },
        {
          id: "concentracao", label: "Concentração top 10", value: pct(k.concentracao_top10),
          sub: "Receita dos 10 maiores clientes",
          market: "Benchmark: abaixo de 30% (risco alto acima de 40%)",
          status: status(k.concentracao_top10, { good: 30, warn: 40, direction: "down" }),
        },
        {
          id: "clientes_ano", label: "Clientes que faturaram", value: num(k.clientes_ano),
          sub: `${num(k.clientes_mes)} no mês atual`,
          market: `Base cadastrada ${num(a.pessoa_total)} · penetração ${penetracao == null ? "—" : pct(penetracao)}`,
          status: status(penetracao, { good: 15, warn: 8, direction: "up" }),
        },
      ],
    },
    {
      id: "growth",
      label: "Growth Marketing",
      groups: [
        {
          label: "North Star — ocupação da frota",
          kpis: [
            {
              id: "north_star", label: "Taxa de ocupação da frota", value: contratosAtivosPct == null ? "—" : pct(contratosAtivosPct),
              sub: `${num(a.fichloc_ativas)} contratos ativos de ${num(a.fichloc_total)}`,
              market: "North Star do setor: ocupação 60–75% com margem saudável",
              status: status(contratosAtivosPct, { good: 60, warn: 45, direction: "up" }),
            },
            {
              id: "revpae", label: "Receita por contrato locado (RevPAE)", value: a.fichloc_total ? brl(fatTotal / a.fichloc_total) : "—",
              sub: `${brl(fatTotal)} sobre ${num(a.fichloc_total)} contratos`,
              market: "RevPAE deve subir junto com a ocupação, não com desconto de preço",
              status: "neutral",
            },
          ],
        },
        {
          label: "1. Geração de demanda comercial",
          kpis: [
            {
              id: "novos", label: "Novos clientes (ativação)", value: num(k.new_clients),
              sub: `Receita nova ${brl(k.new_client_revenue)}`,
              market: "Aquisição saudável repõe o churn do período",
              status: status(k.new_clients - (k.churned_clients || 0), { good: 0, warn: -200, direction: "up" }),
            },
            {
              id: "mix_receita", label: "Peso da receita nova", value: novosPct == null ? "—" : pct(novosPct),
              sub: `Base recorrente ${brl(k.retained_revenue)}`,
              market: "Ideal B2B: 20–35% de receita nova, o restante recorrente",
              status: status(novosPct, { good: 20, warn: 10, direction: "up" }),
            },
            {
              id: "conv_orcamento", label: "Conversão de orçamento", value: "—",
              sub: "MQL/SQL e propostas fechadas",
              market: "Benchmark: 25–40% dos orçamentos viram contrato · requer base de orçamentos conectada",
              status: "neutral",
            },
            {
              id: "cac", label: "CPL qualificado e CAC", value: "—",
              sub: "Custo de mídia por categoria de equipamento",
              market: "Exige integração com investimento de mídia/CRM para calcular CPL e CAC",
              status: "neutral",
            },
          ],
        },
        {
          label: "2. Eficiência da frota",
          kpis: [
            {
              id: "giro", label: "Contratos encerrados no período", value: num(a.fichloc_encerradas),
              sub: `${num(a.fichloc_ativas)} seguem ativos`,
              market: "Encerramentos acima das aberturas indicam frota voltando ao pátio",
              status: status((a.fichloc_ativas || 0) - (a.fichloc_encerradas || 0), { good: 0, warn: -500, direction: "up" }),
            },
            {
              id: "ciclo", label: "Remessas x devoluções", value: `${num(remessas)} / ${num(devolucoes)}`,
              sub: "Saídas e retornos de equipamento",
              market: "Devoluções acima das remessas antecipam queda de ocupação",
              status: status(remessas - devolucoes, { good: 0, warn: -500, direction: "up" }),
            },
            {
              id: "idle", label: "Tempo de pátio (idle time)", value: "—",
              sub: "Dias parados por equipamento",
              market: "Requer datas de retorno x nova saída por patrimônio · meta: abaixo de 20 dias",
              status: "neutral",
            },
          ],
        },
        {
          label: "3. Receita e retenção de contas",
          kpis: [
            {
              id: "ltv", label: "LTV médio por cliente", value: brl(k.receita_por_cliente),
              sub: `${num(k.clientes_ano)} clientes faturando`,
              market: "Em locação pesada o lucro vem do cliente que realoca obra após obra",
              status: "neutral",
            },
            {
              id: "rerental", label: "Taxa de recontratação", value: pct(k.retention_rate),
              sub: `${num(k.retained_clients)} de ${num(k.clients_last_year)} clientes voltaram`,
              market: "Locadoras maduras recontratam 55–70% das contas ao ano",
              status: status(k.retention_rate, { good: 55, warn: 40, direction: "up" }),
            },
            {
              id: "churn", label: "Churn de contas", value: pct(k.churn_rate),
              sub: `${num(k.churned_clients)} construtoras sem faturar`,
              market: "Benchmark: churn até 35% ao ano",
              status: status(k.churn_rate, { good: 35, warn: 50, direction: "down" }),
            },
          ],
        },
      ],
    },
    {
      id: "financeiro",
      label: "Financeiro",
      kpis: [
        {
          id: "car", label: "Contas a receber", value: brl(a.car_total),
          sub: `Em aberto ${brl(a.car_aberto)}`,
          market: "Inadimplência do setor gira em torno de 3–5% do CAR",
          status: status(carVencidoPct, { good: 3, warn: 5, direction: "down" }),
          note: carVencidoPct == null ? null : `Vencido ${pct(carVencidoPct)}`,
        },
        {
          id: "cap", label: "Contas a pagar", value: brl(a.cap_total),
          sub: `Firme em aberto ${brl(capFirme)} · provisório ${brl(a.cap_provisorio)}`,
          market: "CAP firme em aberto acima de 35% do emitido pressiona o caixa",
          status: status(capAbertoPct, { good: 25, warn: 35, direction: "down" }),
          note: capAbertoPct == null
            ? null
            : `${pct(capAbertoPct)} firme em aberto · vencido ${pct(capVencidoPct)}`,
        },
        {
          id: "margem", label: "Margem de fluxo", value: pct(a.margem_percent),
          sub: `Resultado ${brl(a.margem_fluxo)}`,
          market: "Locação madura opera com margem operacional de 15–30%",
          status: status(a.margem_percent, { good: 15, warn: 0, direction: "up" }),
        },
        {
          id: "gerada", label: "Receita gerada (pré-faturamento)", value: brl(a.receita_gerada),
          sub: `Realizada ${brl(k.fat_ano)}`,
          market: "Diferença grande indica faturamento represado",
          status: "neutral",
        },
      ],
    },
    {
      id: "logistica",
      label: "Logística",
      kpis: [
        {
          id: "clientes_ativos", label: "Clientes com contrato ativo", value: num(baseAtivos),
          sub: `De ${num(a.pessoa_total)} cadastrados`,
          market: "Foco: converter cadastro parado em contrato ativo",
          status: status(penetracao, { good: 15, warn: 8, direction: "up" }),
        },
        {
          id: "movimentos", label: "Movimentos de estoque", value: num(a.est_mov_total),
          sub: "Total de operações no período",
          market: "Volume operacional — acompanhe junto com receita",
          status: "neutral",
        },
      ],
    },
    {
      id: "manutencao",
      label: "Manutenção",
      kpis: [
        {
          id: "insp_remessa", label: "Inspeções por remessa", value: inspPorRemessa == null ? "—" : inspPorRemessa.toFixed(1),
          sub: `${num(inspecoes)} inspeções em ${num(remessas)} remessas`,
          market: "Referência: ao menos 2 inspeções por ciclo (saída e retorno)",
          status: status(inspPorRemessa, { good: 2, warn: 1, direction: "up" }),
        },
      ],
    },
  ];
}