// Diagnóstico do momento atual e decisões necessárias para crescimento sustentável.
// Todo achado é derivado dos KPIs reais do ERP + faixas de referência do BENCHMARKS.
// Severidade: "red" = crítico (ação imediata) · "amber" = ponto de atenção · "green" = congruente.

import { BENCHMARKS } from "@/lib/longTermProjection";

const fmtPct = (v) => (v == null ? "—" : `${v.toFixed(1)}%`);
const fmtAnos = (v) => (v == null ? "—" : `${v.toFixed(1)} anos`);

export function diagnose(kpis, summary) {
  if (!kpis) return { findings: [], score: null };
  const f = [];
  const add = (severity, area, title, evidence, action) =>
    f.push({ severity, area, title, evidence, action });

  // 1. Yield da frota
  const y = kpis.yield_frota;
  const byY = BENCHMARKS.yield_frota;
  if (y == null) add("amber", "Frota", "Yield da frota não apurável", "Valor do parque não disponível na base.", "Auditar cadastro de patrimônios para permitir o cálculo de retorno do ativo.");
  else if (y < byY.min) add("red", "Frota", "Frota rende abaixo do mercado", `Yield de ${fmtPct(y)} contra referência de ${byY.min}% a ${byY.max}%.`, "Revisar tabela de preços, ocupação e desmobilizar ativos improdutivos antes de comprar novos.");
  else if (y > byY.max) add("amber", "Frota", "Frota possivelmente subdimensionada", `Yield de ${fmtPct(y)} acima da referência (${byY.max}%) — sinal de frota esticada.`, "Antecipar CAPEX: sem novos ativos, a receita atual já é o teto de capacidade.");
  else add("green", "Frota", "Retorno da frota saudável", `Yield de ${fmtPct(y)} dentro da referência de mercado.`, "Manter política de preço e ocupação atual.");

  // 2. Reinvestimento
  const r = kpis.capex_ratio_3a;
  const byR = BENCHMARKS.reinvestimento;
  if (r != null && r < byR.min) add("red", "Capital", "Reinvestimento insuficiente", `CAPEX de ${fmtPct(r)} da receita (3 anos) contra mínimo de ${byR.min}%.`, "Elevar o orçamento anual de compra de ativos: abaixo disso a frota encolhe e a receita cai por capacidade.");
  else if (r != null && r > byR.max) add("amber", "Capital", "Reinvestimento acima do padrão", `CAPEX de ${fmtPct(r)} da receita, acima de ${byR.max}%.`, "Validar funding e prazo de payback de cada compra; controlar alavancagem e caixa livre.");
  else if (r != null) add("green", "Capital", "Reinvestimento equilibrado", `CAPEX de ${fmtPct(r)} da receita, dentro da referência.`, "Manter o ciclo de reposição no patamar atual.");

  // 3. Idade média da frota
  const idade = kpis.idade_media;
  const byI = BENCHMARKS.idade_frota;
  if (idade != null && idade > byI.max) add("red", "Frota", "Frota envelhecida", `Idade média de ${fmtAnos(idade)} contra referência de ${byI.min} a ${byI.max} anos · ${kpis.ativos_acima_10a} ativos acima de 10 anos.`, "Montar plano de renovação por família de equipamento: manutenção e indisponibilidade sobem antes da receita.");
  else if (idade != null && idade < byI.min) add("green", "Frota", "Frota nova", `Idade média de ${fmtAnos(idade)}.`, "Aproveitar janela de baixa manutenção para ganhar ocupação.");
  else if (idade != null) add("green", "Frota", "Idade da frota adequada", `Idade média de ${fmtAnos(idade)} na faixa de referência.`, "Seguir com a reposição programada.");

  // 4. Payback
  const p = kpis.payback_anos;
  const byP = BENCHMARKS.payback;
  if (p != null && p > byP.max) add("amber", "Capital", "Payback longo do ativo", `Retorno em ${fmtAnos(p)} contra referência de ${byP.min} a ${byP.max} anos.`, "Rever preço/dia e prazo mínimo de contrato nas famílias de menor giro.");
  else if (p != null) add("green", "Capital", "Payback do ativo competitivo", `Retorno em ${fmtAnos(p)}.`, "Usar como critério de aprovação de novas compras.");

  // 5. Desaceleração de crescimento
  const g3 = kpis.cagr_3a, g5 = kpis.cagr_5a;
  if (g3 != null && g5 != null) {
    const gap = g3 - g5;
    if (gap < -8) add("red", "Crescimento", "Crescimento em forte desaceleração", `CAGR de 3 anos (${fmtPct(g3)}) muito abaixo do de 5 anos (${fmtPct(g5)}).`, "Investigar perda de base e preço: o plano de longo prazo não se sustenta sem retomar a curva comercial.");
    else if (gap < -2) add("amber", "Crescimento", "Crescimento perdendo tração", `CAGR de 3 anos (${fmtPct(g3)}) abaixo do de 5 anos (${fmtPct(g5)}).`, "Reforçar retenção da base e expansão em novas praças/famílias.");
    else add("green", "Crescimento", "Curva de crescimento consistente", `CAGR de 3 anos (${fmtPct(g3)}) em linha com o de 5 anos (${fmtPct(g5)}).`, "Manter o motor comercial e vincular metas ao cenário base.");
  }

  // 6. Eficiência marginal do capital
  const rc = kpis.receita_por_capex;
  if (rc != null) {
    if (rc < 0.2) add("red", "Capital", "Capital investido gerando pouca receita", `Cada R$ 1 de CAPEX gerou R$ ${rc.toFixed(2)} de receita adicional (média 5 anos).`, "Congelar compras genéricas e comprar só por demanda contratada/ocupação comprovada.");
    else if (rc < 0.4) add("amber", "Capital", "Eficiência do CAPEX moderada", `Cada R$ 1 investido gerou R$ ${rc.toFixed(2)} de receita adicional.`, "Priorizar famílias com maior ocupação e ticket na próxima leva de compras.");
    else add("green", "Capital", "CAPEX com boa conversão em receita", `Cada R$ 1 investido gerou R$ ${rc.toFixed(2)} de receita adicional.`, "Manter o critério de alocação de investimento vigente.");
  }

  // 7. Esforço de investimento exigido pelo plano
  if (summary && kpis.capex_ultimo_ano > 0) {
    const ratio = summary.capex_medio_ano / kpis.capex_ultimo_ano;
    if (ratio > 2) add("red", "Plano", "Plano exige investimento muito acima do atual", `Média de R$ ${Math.round(summary.capex_medio_ano).toLocaleString("pt-BR")} por ano contra R$ ${Math.round(kpis.capex_ultimo_ano).toLocaleString("pt-BR")} no último ano (${ratio.toFixed(1)}x).`, "Definir a estrutura de funding (capital próprio, dívida, leasing) antes de assumir o cenário base como meta.");
    else if (ratio > 1.3) add("amber", "Plano", "Plano exige elevar o CAPEX anual", `Necessário ${ratio.toFixed(1)}x o investimento do último ano para sustentar o cenário base.`, "Escalonar o aumento de CAPEX em orçamento plurianual.");
    else add("green", "Plano", "Investimento do plano é factível", `Necessidade média anual próxima do CAPEX praticado (${ratio.toFixed(1)}x).`, "Formalizar o valor no orçamento anual.");
  }

  const score = {
    red: f.filter((x) => x.severity === "red").length,
    amber: f.filter((x) => x.severity === "amber").length,
    green: f.filter((x) => x.severity === "green").length,
  };
  return { findings: f, score };
}

/** Passos e decisões, na ordem em que precisam ser tomados. */
export function roadmap(kpis, summary, findings) {
  if (!kpis) return [];
  const criticos = findings.filter((x) => x.severity === "red");
  const atencao = findings.filter((x) => x.severity === "amber");
  const capexAno = summary ? Math.round(summary.capex_medio_ano).toLocaleString("pt-BR") : "—";

  return [
    {
      horizonte: "0 a 90 dias — corrigir o que está crítico",
      decisoes: criticos.length
        ? criticos.map((c) => `${c.title}: ${c.action}`)
        : ["Nenhum indicador em nível crítico. Formalizar o cenário base como meta e travar o orçamento de CAPEX."],
    },
    {
      horizonte: "90 dias a 12 meses — decidir capital e capacidade",
      decisoes: [
        `Aprovar o orçamento de investimento do plano: cerca de R$ ${capexAno} por ano em ativos.`,
        "Escolher a fonte do capital (caixa próprio, dívida bancária, leasing/finame) e o teto de alavancagem aceito.",
        "Definir o critério de aprovação de compra: payback máximo, ocupação mínima e yield mínimo por família.",
        ...atencao.slice(0, 3).map((a) => `${a.title}: ${a.action}`),
      ],
    },
    {
      horizonte: "12 a 36 meses — sustentar a curva",
      decisoes: [
        "Renovar a frota por família seguindo a idade-alvo, desmobilizando ativos de baixo giro.",
        "Proteger a receita recorrente: metas de retenção e contratos de prazo mais longo na base atual.",
        "Diversificar receita (praças, famílias e clientes) para reduzir dependência de poucos contratos.",
        "Estruturar a operação para o novo volume: pessoas, manutenção e capacidade de pátio.",
      ],
    },
    {
      horizonte: "Governança contínua",
      decisoes: [
        "Revisar este painel trimestralmente comparando realizado vs. cenário base.",
        "Rever preço quando o yield sair da faixa de referência, e não apenas na inflação.",
        "Só assumir novo salto de crescimento após o yield e o payback voltarem à faixa saudável.",
      ],
    },
  ];
}