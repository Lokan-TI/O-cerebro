// Empresas fora do escopo de análise (5 = LLK RENTAL · 6 = JCK).
// Mantido em sincronia com base44/shared/empresaScope.ts.
export const EXCLUDED_EMPRESAS = [5, 6];

export function isEmpresaExcluida(cdEmpresa) {
  return EXCLUDED_EMPRESAS.includes(Number(cdEmpresa));
}

// Remove as empresas fora de escopo de qualquer lista com cd_empresa.
export function filterEmpresaRows(rows) {
  if (!Array.isArray(rows)) return rows;
  return rows.filter((r) => !isEmpresaExcluida(r?.cd_empresa));
}