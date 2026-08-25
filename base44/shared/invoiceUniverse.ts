// Contrato fiscal único para qualquer KPI baseado em Nota Fiscal (nf).
// Não confundir com Receita por Grupo SISLOC, que possui universo/fórmula próprios.
//
// Regra canônica de NF faturada:
//   - somente saída: fl_ent_sai = 'S'
//   - não cancelada: fl_can_nf não pode ser 'S' nem 1
//   - sem data de cancelamento
//   - sem data de anulação
// Data padrão do faturamento NF: nf.dt_emi_nf.

export const INVOICE_DATE_FIELD = 'dt_emi_nf';

export function invoiceUniverse(alias = ''): string {
  const p = alias ? `${alias}.` : '';
  return `${p}fl_ent_sai = 'S' ` +
    `AND ISNULL(CAST(${p}fl_can_nf AS varchar(5)), 'N') NOT IN ('S', '1') ` +
    `AND ${p}dt_cancelamento IS NULL ` +
    `AND ${p}dt_anul_nf IS NULL`;
}

export const INVOICE_UNIVERSE = invoiceUniverse();
