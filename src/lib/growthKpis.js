// KPIs de Growth Marketing apurados no Sisloc (analyzeGrowth) + retenção do snapshot.
// Cada indicador declara a fonte física usada, para leitura auditável.

const brl = (v) => (v == null ? "—" : `R$ ${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`);
const pct = (v) => (v == null || Number.isNaN(v) ? "—" : `${Number(v).toFixed(1)}%`);
const num = (v) => (v == null ? "—" : Number(v).toLocaleString("pt-BR"));
const dias = (v) => (v == null ? "—" : `${Number(v).toFixed(0)} dias`);

function status(value, { good, warn, direction }) {
  if (value == null || Number.isNaN(value)) return "neutral";
  if (direction === "down") return value <= good ? "good" : value <= warn ? "warn" : "bad";
  return value >= good ? "good" : value >= warn ? "warn" : "bad";
}

export function buildGrowthKpis(growth, snapshot) {
  if (!growth) return null;
  const d = growth.demanda || {};
  const f = growth.frota || {};
  const r = growth.receita || {};
  const k = snapshot?.kpis || {};

  const saldoCiclo = (f.remessas || 0) - (f.devolucoes || 0);
  const patioPct = f.pat_total ? ((f.pat_patio || 0) / f.pat_total) * 100 : null;

  return {
    id: "growth",
    label: "Growth Marketing",
    groups: [
      {
        label: "North Star — ocupação real da frota (patrimon x fl_rem_equ)",
        kpis: [
          {
            id: "ocupacao",
            label: "Ocupação da frota",
            value: pct(f.ocupacao_pct),
            sub: `${num(f.pat_locados)} patrimônios em campo de ${num(f.pat_total)} próprios`,
            market: "North Star do setor: 60–75% da frota em campo",
            status: status(f.ocupacao_pct, { good: 60, warn: 45, direction: "up" }),
            note: `Frota imobilizada ${brl(f.vl_frota)}`,
          },
          {
            id: "revpae",
            label: "Receita por patrimônio locado",
            value: brl(r.revpae),
            sub: `${brl(r.vl_gerado)} faturados em ${num(r.qtd_faturas)} faturas`,
            market: "Deve subir junto com a ocupação, não por desconto de preço",
            status: "neutral",
            note: `Por patrimônio da frota ${brl(r.receita_por_patrimonio)}`,
          },
        ],
      },
      {
        label: "1. Geração de demanda (fich_loc — propostas de locação)",
        kpis: [
          {
            id: "propostas",
            label: "Propostas de locação",
            value: num(d.propostas),
            sub: `${num(d.clientes)} clientes distintos no período`,
            market: "Volume de demanda que entra no funil de locação",
            status: "neutral",
          },
          {
            id: "conversao",
            label: "Conversão de proposta",
            value: pct(d.aprovacao_pct),
            sub: `${num(d.aprovadas)} de ${num(d.propostas)} aprovadas`,
            market: "Benchmark: 25–40% das propostas viram contrato",
            status: status(d.aprovacao_pct, { good: 40, warn: 25, direction: "up" }),
            note: `Aprovação em ${dias(d.dias_aprovacao)}`,
          },
          {
            id: "ativacao",
            label: "Ativação (proposta → saída física)",
            value: pct(d.ativacao_pct),
            sub: `${num(d.ativadas)} propostas geraram remessa`,
            market: "Proposta aprovada sem saída de equipamento é receita perdida",
            status: status(d.ativacao_pct, { good: 50, warn: 35, direction: "up" }),
            note: `${num(d.clientes_atendidos)} clientes atendidos`,
          },
          {
            id: "ticket",
            label: "Ticket médio por contrato ativado",
            value: brl(d.ticket_contrato),
            sub: `Receita gerada dividida pelos contratos com saída`,
            market: "Ticket precisa crescer acima da inflação ano a ano",
            status: "neutral",
          },
        ],
      },
      {
        label: "2. Eficiência da frota (fl_remessa x fl_devolucao)",
        kpis: [
          {
            id: "ciclo",
            label: "Remessas x devoluções",
            value: `${num(f.remessas)} / ${num(f.devolucoes)}`,
            sub: "Saídas físicas e retornos no período",
            market: "Devoluções acima das remessas antecipam queda de ocupação",
            status: status(saldoCiclo, { good: 0, warn: -500, direction: "up" }),
            note: `Saldo ${saldoCiclo > 0 ? "+" : ""}${num(saldoCiclo)}`,
          },
          {
            id: "idle",
            label: "Tempo de pátio (idle time)",
            value: dias(f.idle_medio),
            sub: `${num(f.pat_patio)} patrimônios parados após devolução`,
            market: "Meta do setor: abaixo de 20 dias entre devolução e nova saída",
            status: status(f.idle_medio, { good: 20, warn: 60, direction: "down" }),
            note: `${num(f.idle_60)} parados há mais de 60 dias`,
          },
          {
            id: "patio_peso",
            label: "Frota parada sobre o total",
            value: pct(patioPct),
            sub: `${num(f.pat_patio)} de ${num(f.pat_total)} patrimônios`,
            market: "Frota parada é capital imobilizado sem gerar receita",
            status: status(patioPct, { good: 15, warn: 30, direction: "down" }),
          },
          {
            id: "contratos_ativos",
            label: "Contratos em andamento",
            value: num(d.ativas),
            sub: `${num(d.encerradas)} encerrados no período`,
            market: "Encerramentos acima das aberturas indicam frota voltando ao pátio",
            status: status((d.ativas || 0) - (d.encerradas || 0), { good: 0, warn: -500, direction: "up" }),
          },
        ],
      },
      {
        label: "3. Receita e retenção de contas (nf + pessoa)",
        kpis: [
          {
            id: "ltv",
            label: "Receita média por cliente atendido",
            value: brl(r.receita_por_cliente),
            sub: `${num(d.clientes_atendidos)} clientes com equipamento em obra`,
            market: "Em locação pesada o lucro vem do cliente que realoca obra após obra",
            status: "neutral",
          },
          {
            id: "novos",
            label: "Novos clientes (ativação)",
            value: num(k.new_clients),
            sub: `Receita nova ${brl(k.new_client_revenue)}`,
            market: "Aquisição saudável repõe o churn do período",
            status: status((k.new_clients || 0) - (k.churned_clients || 0), { good: 0, warn: -200, direction: "up" }),
          },
          {
            id: "rerental",
            label: "Taxa de recontratação",
            value: pct(k.retention_rate),
            sub: `${num(k.retained_clients)} de ${num(k.clients_last_year)} clientes voltaram`,
            market: "Locadoras maduras recontratam 55–70% das contas ao ano",
            status: status(k.retention_rate, { good: 55, warn: 40, direction: "up" }),
          },
          {
            id: "churn",
            label: "Churn de contas",
            value: pct(k.churn_rate),
            sub: `${num(k.churned_clients)} clientes sem faturar`,
            market: "Benchmark: churn até 35% ao ano",
            status: status(k.churn_rate, { good: 35, warn: 50, direction: "down" }),
          },
        ],
      },
    ],
  };
}