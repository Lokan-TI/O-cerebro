// Universo padrão de empresas (regra validada): empresas 5 e 6 (LLK RENTAL / inativas) ficam fora
// de todas as métricas consolidadas e snapshots. Registros com cd_empresa NULL são mantidos
// (equivale a ISNULL(cd_empresa, 0) NOT IN (5, 6)) e exibidos à parte, sem atribuição de empresa.
// Para car usar cd_empresa_gestora (mesmo campo de car_aberto/car_vencido do ClienteDimSnapshot).
export const EXCLUDED_EMPRESAS: number[] = [5, 6];
export const EXCLUDED_EMPRESAS_REASON = 'Empresas 5 e 6 (LLK RENTAL / inativas) excluídas do universo analítico; cd_empresa NULL mantido e exibido à parte.';

// Fragmento AND para consultas com coluna cd_empresa (opcionalmente com alias de tabela).
export function empFilter(alias = '', column = 'cd_empresa') {
  if (EXCLUDED_EMPRESAS.length === 0) return '';
  const prefix = alias ? `${alias}.` : '';
  const list = `(${EXCLUDED_EMPRESAS.join(',')})`;
  return `AND (${prefix}${column} IS NULL OR ${prefix}${column} NOT IN ${list})`;
}