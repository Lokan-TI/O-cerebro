import { base44 } from "@/api/base44Client";
import { MATCH_LABEL, PRODUCT_LABEL } from "@/lib/rdFunnelQuery";

const COLS = [
  ["Fonte", (r) => PRODUCT_LABEL[r.product] || r.product], ["ID externo", (r) => r.external_id], ["Nome", (r) => r.name],
  ["E-mail", (r) => r.email], ["Telefone", (r) => r.phone], ["Documento", (r) => r.document], ["Empresa (RD)", (r) => r.company_name],
  ["Campanha", (r) => r.campaign], ["Origem", (r) => r.origin], ["Etapa", (r) => r.stage], ["Status negociação", (r) => r.deal_status],
  ["Valor negociação", (r) => r.amount], ["Criado em", (r) => r.source_created_at], ["Correspondência", (r) => MATCH_LABEL[r.match_status]?.[0]],
  ["Método", (r) => r.match_method], ["Cliente ERP", (r) => r.erp_cd_pessoa], ["Nome ERP", (r) => r.erp_nm_pessoa], ["Empresa ERP", (r) => r.erp_cd_empresa],
  ["Receita pós-lead", (r) => r.erp_receita_pos_lead], ["Receita total", (r) => r.erp_receita_total], ["Primeira NF", (r) => r.erp_primeira_nf],
  ["Candidatos", (r) => r.erp_candidates], ["Sincronizado em", (r) => r.synced_at],
];
const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export async function exportRdTrace(query) {
  const rows = [];
  let cursor;
  do {
    const page = await base44.entities.RdLead.filter(query, { sort: "-source_created_at", limit: 1000, cursor });
    rows.push(...page.items);
    cursor = page.has_more ? page.next_cursor : null;
  } while (cursor);
  const csv = [COLS.map((c) => cell(c[0])).join(";"), ...rows.map((r) => COLS.map((c) => cell(c[1](r))).join(";"))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
  a.download = `funil_rd_erp_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}