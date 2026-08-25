// Empresas fora do escopo analítico por regra de negócio aprovada em 25/08/2026.
// 5 = LLK RENTAL · 6 = JCK.
// Ambas estão inativas operacionalmente: não recebem novos cadastros, contratos nem
// lançamentos. A exclusão é deliberada e deve permanecer rastreável nas reconciliações.
export const EXCLUDED_EMPRESAS = [5, 6];
export const EXCLUDED_EMPRESAS_REASON = 'Empresas 5 e 6 inativas: sem novos cadastros, contratos ou lançamentos.';

const LIST = `(${EXCLUDED_EMPRESAS.join(',')})`;

// Fragmento AND para consultas com coluna cd_empresa (opcionalmente com alias de tabela).
export function empFilter(alias = '', column = 'cd_empresa') {
  const prefix = alias ? `${alias}.` : '';
  return `AND (${prefix}${column} IS NULL OR ${prefix}${column} NOT IN ${LIST})`;
}