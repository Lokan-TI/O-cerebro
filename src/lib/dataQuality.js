// Diagnóstico de qualidade/congruência dos dados + comparação com benchmarks
// de mercado de grandes locadoras (equipamentos/máquinas).

const pct = (a, b) => (b > 0 ? (a / b) * 100 : null);

export function buildQualityChecks(snapshot) {
  if (!snapshot) return [];
  const k = snapshot.kpis || {};
  const byEmp = snapshot.by_empresa || [];
  const monthly = snapshot.monthly_revenue || [];
  const topClients = snapshot.top_clients || [];
  const checks = [];

  // 1. Congruência: soma das empresas x consolidado
  const somaEmp = byEmp.reduce((s, e) => s + (Number(e.fat_ano) || 0), 0);
  const totalCons = Number(k.fat_ano) || 0;
  const diff = totalCons > 0 ? Math.abs(somaEmp - totalCons) / totalCons * 100 : null;
  checks.push({
    label: "Congruência de faturamento (filiais x consolidado)",
    status: diff == null ? "unknown" : diff <= 0.5 ? "ok" : diff <= 3 ? "warn" : "bad",
    detail: diff == null
      ? "Sem consolidado para comparar."
      : `Diferença de ${diff.toFixed(2)}% entre a soma das ${byEmp.length} empresas e o total consolidado.`,
  });

  // 2. Cobertura temporal
  const meses = new Set(monthly.map((m) => `${m.ano}-${m.mes}`)).size;
  checks.push({
    label: "Cobertura temporal da série",
    status: meses >= 12 ? "ok" : meses >= 6 ? "warn" : "bad",
    detail: `${meses} meses distintos na série de receita. Dados até ${snapshot.max_date || "—"}.`,
  });

  // 3. Identificação de clientes (cadastro)
  const semNome = topClients.filter((c) => !c.nm_pessoa).length;
  checks.push({
    label: "Integridade do cadastro de clientes",
    status: semNome === 0 ? "ok" : semNome <= 2 ? "warn" : "bad",
    detail: semNome === 0
      ? "Todos os principais clientes possuem razão social preenchida."
      : `${semNome} dos maiores clientes estão sem razão social — risco de duplicidade e de erro na consolidação.`,
  });

  // 4. Coerência da base de clientes (novos + recorrentes x ativos)
  const soma = (Number(k.new_clients) || 0) + (Number(k.retained_clients) || 0);
  const ativos = Number(k.clientes_ano) || 0;
  const dc = ativos > 0 ? Math.abs(soma - ativos) / ativos * 100 : null;
  checks.push({
    label: "Coerência da base de clientes",
    status: dc == null ? "unknown" : dc <= 2 ? "ok" : dc <= 10 ? "warn" : "bad",
    detail: dc == null
      ? "Sem base de clientes calculada."
      : `Novos (${k.new_clients ?? "—"}) + recorrentes (${k.retained_clients ?? "—"}) fecham com ${dc.toFixed(1)}% de desvio sobre os ativos do ano.`,
  });

  // 5. Segmentação por empresa
  const empSemNome = byEmp.filter((e) => !e.nm_empresa).length;
  checks.push({
    label: "Segmentação por empresa/filial",
    status: byEmp.length === 0 ? "bad" : empSemNome > 0 ? "warn" : "ok",
    detail: byEmp.length === 0
      ? "Nenhuma quebra por empresa disponível."
      : `${byEmp.length} empresas mapeadas${empSemNome > 0 ? `, ${empSemNome} sem nome cadastrado` : ""}.`,
  });

  // 6. Série histórica anual
  const anos = (snapshot.annual_evolution || []).length;
  checks.push({
    label: "Histórico anual para análise de tendência",
    status: anos >= 3 ? "ok" : anos >= 1 ? "warn" : "bad",
    detail: anos > 0 ? `${anos} anos de histórico consolidado.` : "Histórico anual ainda não calculado.",
  });

  return checks;
}

// Benchmarks de referência para grandes locadoras
export function buildBenchmarks(snapshot) {
  if (!snapshot) return [];
  const k = snapshot.kpis || {};
  const topClients = snapshot.top_clients || [];
  const top10 = topClients.slice(0, 10).reduce((s, c) => s + (Number(c.total) || 0), 0);
  const conc = pct(top10, Number(k.fat_ano) || 0);

  const rows = [
    {
      label: "Churn anual de clientes",
      value: k.churn_rate,
      fmt: (v) => `${v.toFixed(1)}%`,
      market: "15% a 25%",
      good: (v) => v <= 25,
      warn: (v) => v <= 35,
      advice: "Acima de 35% indica operação de curto prazo (spot). Criar carteira nomeada, contratos recorrentes e gestão ativa dos clientes inativos há 90 dias.",
    },
    {
      label: "Retenção de clientes",
      value: k.retention_rate,
      fmt: (v) => `${v.toFixed(1)}%`,
      market: "75% a 85%",
      good: (v) => v >= 75,
      warn: (v) => v >= 60,
      advice: "Locadoras líderes retêm 3 de cada 4 clientes. Programa de pós-obra, SLA de atendimento e renovação antecipada de contrato elevam esse índice.",
    },
    {
      label: "Concentração no top 10 clientes",
      value: conc,
      fmt: (v) => `${v.toFixed(1)}%`,
      market: "até 30%",
      good: (v) => v <= 30,
      warn: (v) => v <= 45,
      advice: "Concentração alta expõe o caixa à perda de uma única conta. Diversificar setores e regiões e definir teto de exposição por cliente.",
    },
    {
      label: "Crescimento anual de receita",
      value: k.crescimento_ano,
      fmt: (v) => `${v > 0 ? "+" : ""}${v.toFixed(1)}%`,
      market: "8% a 15% a.a.",
      good: (v) => v >= 8,
      warn: (v) => v >= 0,
      advice: "Crescimento saudável vem de mix (novos ativos + expansão na base). Crescer só por aquisição de novos clientes com churn alto destrói margem.",
    },
    {
      label: "Receita média por cliente",
      value: k.receita_por_cliente,
      fmt: (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v),
      market: "referência interna",
      good: () => true,
      warn: () => true,
      advice: "Acompanhar a evolução mês a mês: queda com base crescendo significa entrada de clientes pequenos e pulverização do atendimento.",
    },
  ];

  return rows.map((r) => {
    const v = r.value == null ? null : Number(r.value);
    const status = v == null ? "unknown" : r.good(v) ? "ok" : r.warn(v) ? "warn" : "bad";
    return { label: r.label, display: v == null ? "—" : r.fmt(v), market: r.market, status, advice: r.advice };
  });
}

export function qualityScore(checks) {
  if (!checks.length) return null;
  const w = { ok: 100, warn: 60, bad: 20, unknown: 50 };
  return Math.round(checks.reduce((s, c) => s + w[c.status], 0) / checks.length);
}