// Phase 4/5 · Customer Lifecycle v1 — máquina de estados única do doc 10.
// Evento base de atividade: NF emitida (mesmo universo canônico de MTR-001).
// Regra transversal: as_of_date explícito; proibido derivar estado de new Date().
import { INVOICE_UNIVERSE, INVOICE_DATE_FIELD } from './metricRegistry.ts';
import { empFilter } from './empresaScope.ts';

export const LIFECYCLE_VERSION = 'v1';

// Estados pós-NF (universo v1 = clientes com ≥1 NF válida; estados pré-venda ficam fora)
export const LIFECYCLE_STATUSES = ['REPEAT', 'ACTIVE', 'REACTIVATED', 'AT_RISK', 'DORMANT', 'CHURNED'];

export function minusDays(dateStr: string, days: number) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

// Uma passada sargável em nf: buckets de recência relativos ao as_of_date.
export function buildLifecycleSql(asOf: string) {
  const d90 = minusDays(asOf, 90);
  const d180 = minusDays(asOf, 180);
  const d365 = minusDays(asOf, 365);
  const F = INVOICE_DATE_FIELD;
  return `SELECT cd_pessoa,
    MIN(${F}) AS first_nf, MAX(${F}) AS last_nf,
    SUM(CASE WHEN ${F} >= '${d90}' THEN 1 ELSE 0 END) AS cnt_0_90,
    SUM(CASE WHEN ${F} >= '${d180}' AND ${F} < '${d90}' THEN 1 ELSE 0 END) AS cnt_91_180,
    SUM(CASE WHEN ${F} >= '${d365}' AND ${F} < '${d180}' THEN 1 ELSE 0 END) AS cnt_181_365,
    SUM(CASE WHEN ${F} < '${d365}' THEN 1 ELSE 0 END) AS cnt_older,
    COUNT(DISTINCT CASE WHEN ${F} >= '${d365}' THEN YEAR(${F}) * 100 + MONTH(${F}) END) AS months_12m,
    SUM(CASE WHEN ${F} >= '${d365}' THEN ISNULL(vl_faturamento, 0) ELSE 0 END) AS rev_12m
    FROM nf WITH (NOLOCK)
    WHERE ${INVOICE_UNIVERSE} AND ${F} < '${asOf}' AND ISNULL(vl_faturamento, 0) > 0
      ${empFilter()}
    GROUP BY cd_pessoa`;
}

// Classificação determinística a partir dos buckets (mutuamente exclusiva).
// Aproximação v1 documentada: REACTIVATED exige nenhuma NF entre 91 e 365 dias
// (garante gap ≥ 181d); gaps de 181–275 dias com atividade intermediária caem em ACTIVE/REPEAT.
export function classifyLifecycle(row: any) {
  const c090 = Number(row.cnt_0_90) || 0;
  const c91 = Number(row.cnt_91_180) || 0;
  const c181 = Number(row.cnt_181_365) || 0;
  const older = Number(row.cnt_older) || 0;
  const months = Number(row.months_12m) || 0;
  if (c090 > 0) {
    if (c91 === 0 && c181 === 0 && older > 0) return 'REACTIVATED';
    if (months >= 2) return 'REPEAT';
    return 'ACTIVE';
  }
  if (c91 > 0) return 'AT_RISK';
  if (c181 > 0) return 'DORMANT';
  return 'CHURNED';
}

// Mapeamento de famílias para reconciliação com o motor legado (9 status por remessa).
export const V1_FAMILIES: Record<string, string> = {
  REPEAT: 'ativo', ACTIVE: 'ativo', REACTIVATED: 'ativo',
  AT_RISK: 'risco',
  DORMANT: 'churn', CHURNED: 'churn',
};
export const LEGACY_FAMILIES: Record<string, string> = {
  'Novo ativo': 'ativo', 'Recorrente': 'ativo', 'Reativado': 'ativo',
  'Em risco': 'risco',
  'Em churn': 'churn', 'Dormente': 'churn', 'Churn confirmado': 'churn',
  'Prospector': 'pre_venda', 'Novo cadastro': 'pre_venda',
};