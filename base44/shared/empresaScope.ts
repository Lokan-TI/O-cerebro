// Escopo analítico padrão: não excluir empresas silenciosamente.
// A fidelidade ao ERP exige preservar registros históricos inclusive de empresas hoje inativas.
// Restrições de empresa devem vir do relatório SISLOC reproduzido ou de filtro explícito do usuário.
export const EXCLUDED_EMPRESAS: number[] = [];
export const EXCLUDED_EMPRESAS_REASON = 'Nenhuma exclusão global. Empresa inativa é atributo operacional, não filtro histórico implícito.';

// Fragmento AND para consultas com coluna cd_empresa (opcionalmente com alias de tabela).
export function empFilter(alias = '', column = 'cd_empresa') {
  if (EXCLUDED_EMPRESAS.length === 0) return '';
  const prefix = alias ? `${alias}.` : '';
  const list = `(${EXCLUDED_EMPRESAS.join(',')})`;
  return `AND (${prefix}${column} IS NULL OR ${prefix}${column} NOT IN ${list})`;
}