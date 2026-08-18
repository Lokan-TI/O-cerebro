// Empresas fora do escopo de análise — unidades que não são mais movimentadas.
// 5 = LLK RENTAL · 6 = JCK
export const EXCLUDED_EMPRESAS = [5, 6];

const LIST = `(${EXCLUDED_EMPRESAS.join(',')})`;

// Fragmento AND para consultas com coluna cd_empresa (opcionalmente com alias de tabela).
export function empFilter(alias = '', column = 'cd_empresa') {
  const prefix = alias ? `${alias}.` : '';
  return `AND (${prefix}${column} IS NULL OR ${prefix}${column} NOT IN ${LIST})`;
}