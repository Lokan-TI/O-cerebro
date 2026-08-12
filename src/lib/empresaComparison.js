import { getEmpresaLabel } from "@/lib/empresaLabels";

// Monta as linhas de comparação entre empresas a partir do snapshot
export function buildEmpresaComparison(snapshot) {
  if (!snapshot) return [];
  const fich = snapshot.analytics?.fichloc_by_empresa || [];
  const car = snapshot.analytics?.car_by_empresa || [];

  return (snapshot.by_empresa || [])
    .map((e) => {
      const f = fich.find((x) => x.cd_empresa === e.cd_empresa) || {};
      const c = car.find((x) => x.cd_empresa === e.cd_empresa) || {};
      return {
        cd_empresa: e.cd_empresa,
        nome: getEmpresaLabel(e.cd_empresa, e.nm_empresa),
        faturamento: e.fat_ano || 0,
        crescimento: e.crescimento_ano ?? null,
        ticket: e.ticket_ano || 0,
        retencao: e.retention_rate ?? null,
        churn: e.churn_rate ?? null,
        ocupacao: f.qtd ? (f.qtd_ativas / f.qtd) * 100 : null,
        vencido: c.vl_total ? (c.vl_vencido / c.vl_total) * 100 : null,
      };
    })
    .sort((a, b) => b.faturamento - a.faturamento);
}

const fmtPct = (v) => (v == null ? "—" : `${v.toFixed(1)}%`);

// Dicas comparando cada empresa com os benchmarks do setor de locação
export function buildEmpresaTips(rows) {
  const tips = [];
  if (!rows.length) return tips;

  const baixaOcupacao = rows.filter((r) => r.ocupacao != null && r.ocupacao < 60);
  if (baixaOcupacao.length)
    tips.push({
      tone: "bad",
      text: `Ocupação de frota abaixo do benchmark do setor (60–75%) em ${baixaOcupacao
        .map((r) => `${r.nome} (${fmtPct(r.ocupacao)})`)
        .join(", ")}. Priorize remanejar equipamento parado para as unidades com fila de demanda.`,
    });

  const churnAlto = rows.filter((r) => r.churn != null && r.churn > 50);
  if (churnAlto.length)
    tips.push({
      tone: "bad",
      text: `Churn acima de 50% (benchmark: até 35% a.a.) em ${churnAlto
        .map((r) => `${r.nome} (${fmtPct(r.churn)})`)
        .join(", ")}. Ative rotina de recontratação nas contas que faturaram no ano anterior.`,
    });

  const queda = rows.filter((r) => r.crescimento != null && r.crescimento < 0);
  if (queda.length)
    tips.push({
      tone: "warn",
      text: `Faturamento em queda ano a ano em ${queda
        .map((r) => `${r.nome} (${fmtPct(r.crescimento)})`)
        .join(", ")}, enquanto o setor cresce 10–15% a.a. Compare o mix de equipamentos com as unidades que crescem.`,
    });

  const inadimplencia = rows.filter((r) => r.vencido != null && r.vencido > 5);
  if (inadimplencia.length)
    tips.push({
      tone: "warn",
      text: `Recebíveis vencidos acima de 5% do CAR em ${inadimplencia
        .map((r) => `${r.nome} (${fmtPct(r.vencido)})`)
        .join(", ")}. Revise crédito e cobrança antes de liberar novas remessas.`,
    });

  const melhor = rows.filter((r) => r.ocupacao != null).sort((a, b) => b.ocupacao - a.ocupacao)[0];
  if (melhor)
    tips.push({
      tone: "good",
      text: `${melhor.nome} lidera em ocupação (${fmtPct(melhor.ocupacao)}) com ticket médio de R$ ${Math.round(
        melhor.ticket
      ).toLocaleString("pt-BR")}. Use a operação dela como referência de processo para as demais filiais.`,
    });

  return tips;
}