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
  const capAbertoPct = a.cap_total ? (a.cap_aberto / a.cap_total) * 100 : null;
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
      id: "marketing",
      label: "Marketing & Retenção",
      kpis: [
        {
          id: "retencao", label: "Taxa de retenção", value: pct(k.retention_rate),
          sub: `${num(k.retained_clients)} de ${num(k.clients_last_year)} clientes`,
          market: "Locadoras maduras retêm 55–70% da base anual",
          status: status(k.retention_rate, { good: 55, warn: 40, direction: "up" }),
        },
        {
          id: "churn", label: "Churn de clientes", value: pct(k.churn_rate),
          sub: `${num(k.churned_clients)} clientes sem faturar`,
          market: "Benchmark: churn até 35% ao ano",
          status: status(k.churn_rate, { good: 35, warn: 50, direction: "down" }),
        },
        {
          id: "novos", label: "Novos clientes", value: num(k.new_clients),
          sub: `Receita nova ${brl(k.new_client_revenue)}`,
          market: "Aquisição saudável repõe o churn do período",
          status: status(k.new_clients - (k.churned_clients || 0), { good: 0, warn: -200, direction: "up" }),
        },
        {
          id: "mix_receita", label: "Receita de novos clientes", value: novosPct == null ? "—" : pct(novosPct),
          sub: `Base recorrente ${brl(k.retained_revenue)}`,
          market: "Ideal: 20–35% da receita vindo de novos, resto recorrente",
          status: status(novosPct, { good: 20, warn: 10, direction: "up" }),
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
          sub: `Em aberto ${brl(a.cap_aberto)}`,
          market: "CAP em aberto acima de 35% pressiona o caixa",
          status: status(capAbertoPct, { good: 25, warn: 35, direction: "down" }),
          note: capAbertoPct == null ? null : `${pct(capAbertoPct)} em aberto`,
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
          id: "contratos", label: "Contratos ativos", value: num(a.fichloc_ativas),
          sub: `${num(a.fichloc_total)} contratos no período`,
          market: "Utilização de frota do setor: 60–75%",
          status: status(contratosAtivosPct, { good: 60, warn: 45, direction: "up" }),
          note: contratosAtivosPct == null ? null : `${pct(contratosAtivosPct)} ativos`,
        },
        {
          id: "remessas", label: "Remessas realizadas", value: num(remessas),
          sub: `${num(devolucoes)} devoluções requisitadas`,
          market: "Devoluções muito acima das remessas = contração da frota locada",
          status: status(remessas - devolucoes, { good: 0, warn: -500, direction: "up" }),
        },
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
          id: "inspecoes", label: "Inspeções realizadas", value: num(inspecoes),
          sub: "Entradas e saídas de equipamento",
          market: "Toda remessa e retorno deve gerar inspeção registrada",
          status: "neutral",
        },
        {
          id: "insp_remessa", label: "Inspeções por remessa", value: inspPorRemessa == null ? "—" : inspPorRemessa.toFixed(1),
          sub: `${num(remessas)} remessas no período`,
          market: "Referência: ao menos 2 inspeções por ciclo (saída e retorno)",
          status: status(inspPorRemessa, { good: 2, warn: 1, direction: "up" }),
        },
      ],
    },
  ];
}