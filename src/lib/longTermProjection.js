// Modelo de previsibilidade de receita de longo prazo para locação de equipamentos.
// Toda métrica aqui é derivada do histórico do ERP; nada é constante inventada,
// exceto as faixas de referência de mercado abaixo (explícitas e rotuladas).

export const BENCHMARKS = {
  yield_frota: { min: 25, max: 40, label: "Yield da frota (receita ÷ valor do parque)", unit: "%" },
  reinvestimento: { min: 15, max: 25, label: "Reinvestimento (CAPEX ÷ receita)", unit: "%" },
  idade_frota: { min: 4, max: 6, label: "Idade média da frota", unit: "anos" },
  payback: { min: 2.5, max: 4, label: "Payback do ativo", unit: "anos" },
};

export const classify = (value, bm, invert = false) => {
  if (value == null || !bm) return "gray";
  const low = value < bm.min;
  const high = value > bm.max;
  if (!low && !high) return "green";
  if (invert) return low ? "green" : "red";
  return low ? "red" : "amber";
};

const cagr = (first, last, years) =>
  first > 0 && last > 0 && years > 0 ? (Math.pow(last / first, 1 / years) - 1) * 100 : null;

/** KPIs factuais a partir do retorno de projectLongTermRevenue. */
export function computeKpis(data) {
  const hist = (data?.history || []).slice().sort((a, b) => a.ano - b.ano);
  if (hist.length === 0) return null;
  const fleet = data?.fleet || {};
  const rev = (r) => (r.parcial ? r.receita_anualizada : r.receita);
  const cap = (r) => (r.parcial ? r.capex_anualizado : r.capex);
  const last = hist[hist.length - 1];
  const receitaAtual = rev(last);

  const at = (n) => hist[hist.length - 1 - n];
  const win = (n) => {
    const from = at(n);
    return from ? cagr(rev(from), receitaAtual, n) : null;
  };

  const last3 = hist.slice(-3);
  const capexRatio3 = last3.reduce((s, r) => s + rev(r), 0) > 0
    ? (last3.reduce((s, r) => s + cap(r), 0) / last3.reduce((s, r) => s + rev(r), 0)) * 100
    : null;

  const valorFrota = fleet.valor_frota || 0;
  const yieldFrota = valorFrota > 0 ? (receitaAtual / valorFrota) * 100 : null;

  // Receita marginal por real investido: Δ receita do ano vs. CAPEX do ano anterior.
  const marginais = [];
  for (let i = 1; i < hist.length; i++) {
    const capexPrev = cap(hist[i - 1]);
    if (capexPrev > 0) marginais.push((rev(hist[i]) - rev(hist[i - 1])) / capexPrev);
  }
  const receitaPorCapex = marginais.length
    ? marginais.slice(-5).reduce((s, v) => s + v, 0) / Math.min(marginais.length, 5)
    : null;

  return {
    ano_atual: last.ano,
    receita_atual: receitaAtual,
    receita_parcial: last.parcial,
    cagr_10a: win(10) ?? win(hist.length - 1),
    cagr_5a: win(5),
    cagr_3a: win(3),
    capex_ratio_3a: capexRatio3,
    capex_ultimo_ano: cap(last),
    valor_frota: valorFrota,
    ativos_ativos: fleet.ativos_ativos || 0,
    idade_media: fleet.idade_media,
    ativos_acima_10a: fleet.ativos_acima_10a || 0,
    capex_historico_total: fleet.capex_historico_total || 0,
    yield_frota: yieldFrota,
    payback_anos: yieldFrota > 0 ? 100 / yieldFrota : null,
    receita_por_capex: receitaPorCapex,
    receita_por_ativo: (fleet.ativos_ativos || 0) > 0 ? receitaAtual / fleet.ativos_ativos : null,
    history: hist.map((r) => ({ ...r, receita_ref: rev(r), capex_ref: cap(r) })),
  };
}

/** Premissas iniciais derivadas do histórico (o usuário pode ajustar na tela). */
export function defaultAssumptions(kpis) {
  const g5 = kpis?.cagr_5a ?? 10;
  const g3 = kpis?.cagr_3a ?? g5;
  const round = (v) => Math.round(v * 10) / 10;
  return {
    horizonte: 10,
    crescimento_base: round(Math.max(3, Math.min(g5, 22))),
    crescimento_conservador: round(Math.max(2, Math.min(g5, 22) * 0.45)),
    crescimento_otimista: round(Math.max(6, Math.min(Math.max(g3, g5), 30))),
    crescimento_terminal: 4,
    yield_frota: round(Math.max(10, Math.min(kpis?.yield_frota ?? 30, 60))),
    reinvestimento: round(Math.max(5, Math.min(kpis?.capex_ratio_3a ?? 20, 45))),
    baixa_frota: 6,
  };
}

// Fade: o crescimento inicial converge linearmente para o crescimento terminal
// ao longo do horizonte — prática padrão em modelos de valuation de longo prazo.
const fadeGrowth = (g0, gT, year, horizon) =>
  (gT + (g0 - gT) * (1 - (year - 1) / horizon)) / 100;

/** Projeção ano a ano nos três cenários + frota e CAPEX necessários no cenário base. */
export function projectScenarios(kpis, a) {
  if (!kpis) return [];
  const H = a.horizonte;
  const rows = [];
  let cons = kpis.receita_atual;
  let base = kpis.receita_atual;
  let otim = kpis.receita_atual;
  let frota = kpis.valor_frota;
  const yieldDec = a.yield_frota / 100;

  for (let t = 1; t <= H; t++) {
    cons *= 1 + fadeGrowth(a.crescimento_conservador, a.crescimento_terminal, t, H);
    base *= 1 + fadeGrowth(a.crescimento_base, a.crescimento_terminal, t, H);
    otim *= 1 + fadeGrowth(a.crescimento_otimista, a.crescimento_terminal, t, H);

    // Frota necessária para sustentar a receita base no yield informado.
    const frotaNecessaria = yieldDec > 0 ? base / yieldDec : 0;
    const frotaRemanescente = frota * (1 - a.baixa_frota / 100);
    const capexNecessario = Math.max(frotaNecessaria - frotaRemanescente, 0);
    frota = Math.max(frotaNecessaria, frotaRemanescente);

    rows.push({
      ano: kpis.ano_atual + t,
      conservador: cons,
      base,
      otimista: otim,
      crescimento_base: fadeGrowth(a.crescimento_base, a.crescimento_terminal, t, H) * 100,
      frota_necessaria: frotaNecessaria,
      capex_necessario: capexNecessario,
      capex_reinvestimento: base * (a.reinvestimento / 100),
    });
  }
  return rows;
}

/** Números de fechamento do horizonte (para cartões e leitura textual). */
export function projectionSummary(kpis, rows) {
  if (!kpis || rows.length === 0) return null;
  const last = rows[rows.length - 1];
  const H = rows.length;
  const capexTotal = rows.reduce((s, r) => s + r.capex_necessario, 0);
  return {
    horizonte: H,
    ano_final: last.ano,
    receita_base: last.base,
    receita_conservador: last.conservador,
    receita_otimista: last.otimista,
    multiplo_base: kpis.receita_atual > 0 ? last.base / kpis.receita_atual : null,
    cagr_base: cagr(kpis.receita_atual, last.base, H),
    frota_necessaria: last.frota_necessaria,
    capex_total: capexTotal,
    capex_medio_ano: capexTotal / H,
    receita_acumulada: rows.reduce((s, r) => s + r.base, 0),
  };
}