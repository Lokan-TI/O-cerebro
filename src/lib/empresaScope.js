// Escopo padrão fiel ao ERP: nenhuma empresa é removida silenciosamente.
// Empresa inativa pode ser sinalizada na UI, mas seus registros históricos permanecem nas análises.
export const EXCLUDED_EMPRESAS = [];
export const EXCLUDED_EMPRESAS_REASON = "Nenhuma exclusão global; filtros de empresa devem ser explícitos.";

export function isEmpresaExcluida(cdEmpresa) {
  return EXCLUDED_EMPRESAS.includes(Number(cdEmpresa));
}

// Remove as empresas fora de escopo de qualquer lista com cd_empresa.
export function filterEmpresaRows(rows) {
  if (!Array.isArray(rows)) return rows;
  return rows.filter((r) => !isEmpresaExcluida(r?.cd_empresa));
}