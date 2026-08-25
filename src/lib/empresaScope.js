// Regra de negócio aprovada em 25/08/2026: empresas 5 = LLK RENTAL e 6 = JCK
// estão inativas operacionalmente e não recebem novos cadastros, contratos ou lançamentos.
// Mantido em sincronia com base44/shared/empresaScope.ts.
export const EXCLUDED_EMPRESAS = [5, 6];
export const EXCLUDED_EMPRESAS_REASON = "Empresas 5 e 6 inativas: sem novos cadastros, contratos ou lançamentos.";

export function isEmpresaExcluida(cdEmpresa) {
  return EXCLUDED_EMPRESAS.includes(Number(cdEmpresa));
}

// Remove as empresas fora de escopo de qualquer lista com cd_empresa.
export function filterEmpresaRows(rows) {
  if (!Array.isArray(rows)) return rows;
  return rows.filter((r) => !isEmpresaExcluida(r?.cd_empresa));
}