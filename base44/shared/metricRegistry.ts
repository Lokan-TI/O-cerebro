// Phase 4 · Semantic Layer — Metric Registry executável (doc 12 é a fonte normativa).
// Regra: nenhum dashboard implementa fórmula. Toda métrica exibida passa por computeMetric.
// Nenhuma métrica está TRUSTED enquanto o dono de negócio não aprovar via ADR.

// Universo canônico de nota fiscal (mesmo usado em reconcileRevenue · MTR-001)
export const INVOICE_UNIVERSE = `fl_ent_sai = 'S' AND ISNULL(fl_can_nf, 'N') <> 'S' AND dt_cancelamento IS NULL AND dt_anul_nf IS NULL`;
export const INVOICE_DATE_FIELD = 'dt_emi_nf';
// Candidato de referência escolhido na reconciliação (pendente de aprovação do CFO)
export const REVENUE_EXPR = 'SUM(ISNULL(vl_faturamento,0))';

export type AnalysisContext = {
  source_id?: string;
  period_start: string;
  period_end: string;
  cd_empresa?: string | null;
  comparison_mode?: 'none' | 'prior_period' | 'prior_year';
};

function empresaClause(ctx: AnalysisContext) {
  return ctx.cd_empresa ? ` AND cd_empresa = '${String(ctx.cd_empresa).replace(/'/g, '')}'` : '';
}

function windowClause(ctx: AnalysisContext, start: string, end: string) {
  return `${INVOICE_UNIVERSE} AND ${INVOICE_DATE_FIELD} >= '${start}' AND ${INVOICE_DATE_FIELD} < '${end}'${empresaClause(ctx)}`;
}

export type MetricDef = {
  metric_id: string;
  business_name: string;
  version: string;
  formula: string;
  grain: string;
  unit: 'BRL' | 'count' | 'percent';
  time_dimension: string;
  business_owner: string;
  technical_owner: string;
  source_of_truth: string;
  trusted: boolean;
  blocking_questions: string[];
  // Retorna a lista de queries a executar e a função que consolida o valor
  build: (ctx: AnalysisContext) => { queries: string[]; reduce: (rows: any[][]) => number | null };
};

const PENDING_OWNER = 'A DEFINIR (CFO)';
const REVENUE_BLOCKERS = [
  'Confirmar se vl_faturamento é a Receita oficial (candidato A da reconciliação).',
  'Definir tratamento das NFs válidas com valor zerado.',
];

export const METRICS: MetricDef[] = [
  {
    metric_id: 'MTR-001',
    business_name: 'Receita',
    version: '0.1',
    formula: 'Σ vl_faturamento sobre NF de saída válida no período',
    grain: 'invoice',
    unit: 'BRL',
    time_dimension: INVOICE_DATE_FIELD,
    business_owner: PENDING_OWNER,
    technical_owner: 'Data Platform',
    source_of_truth: 'nf.vl_faturamento (substituto do canônico Invoice)',
    trusted: false,
    blocking_questions: REVENUE_BLOCKERS,
    build: (ctx) => ({
      queries: [`SELECT ${REVENUE_EXPR} AS v FROM nf WHERE ${windowClause(ctx, ctx.period_start, ctx.period_end)}`],
      reduce: ([r]) => Number(r?.[0]?.v || 0),
    }),
  },
  {
    metric_id: 'MTR-006',
    business_name: 'Ticket médio por cliente faturado',
    version: '0.1',
    formula: 'Receita / clientes distintos com Receita > 0 no período',
    grain: 'customer',
    unit: 'BRL',
    time_dimension: INVOICE_DATE_FIELD,
    business_owner: PENDING_OWNER,
    technical_owner: 'Data Platform',
    source_of_truth: 'derivada de MTR-001',
    trusted: false,
    blocking_questions: [
      ...REVENUE_BLOCKERS,
      'Denominador por cliente faturado (não pela base cadastrada) precisa ser confirmado.',
    ],
    build: (ctx) => ({
      queries: [
        `SELECT ${REVENUE_EXPR} AS v, COUNT(DISTINCT cd_pessoa) AS c FROM nf WHERE ${windowClause(ctx, ctx.period_start, ctx.period_end)} AND ISNULL(vl_faturamento,0) > 0`,
      ],
      reduce: ([r]) => {
        const v = Number(r?.[0]?.v || 0);
        const c = Number(r?.[0]?.c || 0);
        return c ? v / c : null;
      },
    }),
  },
  {
    metric_id: 'MTR-007',
    business_name: 'Concentração dos 10 maiores clientes',
    version: '0.1',
    formula: 'Σ Receita dos top 10 clientes / Receita total do período (N = 10)',
    grain: 'customer',
    unit: 'percent',
    time_dimension: INVOICE_DATE_FIELD,
    business_owner: PENDING_OWNER,
    technical_owner: 'Data Platform',
    source_of_truth: 'derivada de MTR-001',
    trusted: false,
    blocking_questions: [
      ...REVENUE_BLOCKERS,
      'Concentração usa cliente do ERP; sem identity resolution cross-source pode subestimar (ver doc 09).',
    ],
    build: (ctx) => ({
      queries: [
        `SELECT SUM(v) AS topv FROM (SELECT TOP 10 cd_pessoa, ${REVENUE_EXPR} AS v FROM nf WHERE ${windowClause(ctx, ctx.period_start, ctx.period_end)} GROUP BY cd_pessoa ORDER BY 2 DESC) t`,
        `SELECT ${REVENUE_EXPR} AS v FROM nf WHERE ${windowClause(ctx, ctx.period_start, ctx.period_end)}`,
      ],
      reduce: ([top, all]) => {
        const total = Number(all?.[0]?.v || 0);
        return total ? (Number(top?.[0]?.topv || 0) / total) * 100 : null;
      },
    }),
  },
  {
    metric_id: 'MTR-017',
    business_name: 'Clientes faturados no período',
    version: '0.1',
    formula: 'count(distinct cd_pessoa) com Receita > 0 no período',
    grain: 'customer',
    unit: 'count',
    time_dimension: INVOICE_DATE_FIELD,
    business_owner: PENDING_OWNER,
    technical_owner: 'Data Platform',
    source_of_truth: 'nf.cd_pessoa (cliente da nota)',
    trusted: false,
    blocking_questions: ['Contagem por cliente do ERP, não por Party canônico (ver doc 09).'],
    build: (ctx) => ({
      queries: [
        `SELECT COUNT(DISTINCT cd_pessoa) AS c FROM nf WHERE ${windowClause(ctx, ctx.period_start, ctx.period_end)} AND ISNULL(vl_faturamento,0) > 0`,
      ],
      reduce: ([r]) => Number(r?.[0]?.c || 0),
    }),
  },
];

export function getMetric(metricId: string) {
  return METRICS.find((m) => m.metric_id === metricId) || null;
}

// Janela de comparação explícita — MTR-003 exige nomear a comparação exata.
export function comparisonWindow(ctx: AnalysisContext) {
  const mode = ctx.comparison_mode || 'none';
  if (mode === 'none') return null;
  const start = new Date(ctx.period_start + 'T00:00:00Z');
  const end = new Date(ctx.period_end + 'T00:00:00Z');
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (mode === 'prior_year') {
    const s = new Date(start); s.setUTCFullYear(s.getUTCFullYear() - 1);
    const e = new Date(end); e.setUTCFullYear(e.getUTCFullYear() - 1);
    return { label: 'ano anterior (mesma janela)', period_start: iso(s), period_end: iso(e) };
  }
  const span = end.getTime() - start.getTime();
  return {
    label: 'período imediatamente anterior (mesma duração)',
    period_start: iso(new Date(start.getTime() - span)),
    period_end: iso(start),
  };
}