import { base44 } from "@/api/base44Client";

// KPIs comerciais calculados no servidor a partir das negociações sincronizadas do RD CRM.
// Período = data de criação da negociação (source_created_at), janela [start, endExclusive).
export async function loadCommercialKpis(period) {
  const query = { product: "crm_deal", source_created_at: { $gte: period.start, $lt: period.endExclusive } };
  const Lead = base44.entities.RdLead;
  const [byOwner, byOrigin, byStage, byEmpresa, closed] = await Promise.all([
    Lead.aggregate({ query, groupBy: ["owner", "deal_status"], sum: "amount", limit: 1000 }),
    Lead.aggregate({ query, groupBy: "origin", sort: "-count", limit: 50 }),
    Lead.aggregate({ query, groupBy: ["pipeline", "stage"], sort: "-count", limit: 200 }),
    Lead.aggregate({ query: { ...query, match_status: { $in: ["matched", "manual"] } }, groupBy: "erp_cd_empresa", sort: "-count" }),
    Lead.filter({ ...query, deal_status: "won", closed_at: { $gt: "" } }, { fields: ["source_created_at", "closed_at"], limit: 1000 }),
  ]);

  const owners = {};
  const status = { open: 0, won: 0, lost: 0, paused: 0 };
  let wonValue = 0;
  for (const r of byOwner.rows) {
    const o = r.owner || "Sem responsável";
    owners[o] ||= { owner: o, total: 0, open: 0, won: 0, lost: 0, paused: 0, wonValue: 0 };
    owners[o].total += r.count;
    if (r.deal_status in status) { owners[o][r.deal_status] += r.count; status[r.deal_status] += r.count; }
    if (r.deal_status === "won") { owners[o].wonValue += r.sum_amount || 0; wonValue += r.sum_amount || 0; }
  }
  const days = closed.items
    .map((d) => (new Date(d.closed_at) - new Date(d.source_created_at)) / 86400000)
    .filter((n) => n >= 0 && Number.isFinite(n));

  return {
    total: Object.values(status).reduce((a, b) => a + b, 0),
    status,
    wonValue,
    owners: Object.values(owners),
    origins: byOrigin.rows.map((r) => ({ label: r.origin || "Sem origem", value: r.count })),
    stages: byStage.rows.map((r) => ({ label: `${r.pipeline || "—"} · ${r.stage || "—"}`, value: r.count })),
    empresas: byEmpresa.rows.map((r) => ({ label: r.erp_cd_empresa ? `Empresa ${r.erp_cd_empresa}` : "Sem empresa", value: r.count })),
    cycleDays: days.length ? days.reduce((a, b) => a + b, 0) / days.length : null,
    cycleSample: days.length,
  };
}

export const PENDING_KPIS = [
  ["Equipamentos mais solicitados", "Produto/equipamento não vem nas negociações sincronizadas"],

  ["Período mais alugado", "Requer cruzar contratos ERP (fich_loc) com a oportunidade"],
  ["Qtd. alugadas / Locações por vendedor", "Requer cruzar contratos ERP com o vendedor do RD"],
  ["Máquinas mais alugadas", "Requer itens de contrato do ERP vinculados ao RD"],
  ["Perfil do cliente", "Campo personalizado não mapeado"],

  ["Nível de interesse (frio/morno/quente)", "Campo personalizado / avaliação não sincronizada"],

  ["Motivos da perda", "Motivo de perda não é sincronizado hoje"],
  ["Qtd. cards vencidos", "Data prevista de fechamento/tarefas não sincronizadas"],
  ["Qtd. cotação para fazer", "Etapa/tarefa de cotação não definida"],
  ["Tempo para gerar cotação (geral e por vendedor)", "Datas de mudança de etapa não sincronizadas"],
  ["Total de clientes p/ follow (geral e por vendedor)", "Tarefas/atividades do CRM não sincronizadas"],
  ["Follow-ups por ligação (total, por vendedor, média por fechado)", "Atividades de ligação não sincronizadas"],
  ["Follow-ups no WhatsApp (total, por vendedor, média por fechado)", "Histórico do RD Conversas indisponível no plano atual"],
];