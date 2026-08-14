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
  {
    metric_id: 'MTR-018',
    business_name: 'Notas fiscais faturadas no período',
    version: '0.1',
    formula: 'count(*) de NF de saída válida com valor > 0 no período',
    grain: 'invoice',
    unit: 'count',
    time_dimension: INVOICE_DATE_FIELD,
    business_owner: PENDING_OWNER,
    technical_owner: 'Data Platform',
    source_of_truth: 'nf (universo canônico de nota fiscal)',
    trusted: false,
    blocking_questions: ['Definir tratamento das NFs válidas com valor zerado (mesma questão de MTR-001).'],
    build: (ctx) => ({
      queries: [
        `SELECT COUNT(*) AS c FROM nf WHERE ${windowClause(ctx, ctx.period_start, ctx.period_end)} AND ISNULL(vl_faturamento,0) > 0`,
      ],
      reduce: ([r]) => Number(r?.[0]?.c || 0),
    }),
  },
  {
    metric_id: 'MTR-019',
    business_name: 'Novos clientes faturados no período',
    version: '0.1',
    formula: 'clientes com Receita > 0 na janela e nenhuma NF faturada anterior ao início da janela',
    grain: 'customer',
    unit: 'count',
    time_dimension: INVOICE_DATE_FIELD,
    business_owner: PENDING_OWNER,
    technical_owner: 'Data Platform',
    source_of_truth: 'nf.cd_pessoa (primeira nota faturada)',
    trusted: false,
    blocking_questions: [
      'Novo = primeira NF faturada de todos os tempos; o legado usa data de cadastro (ver doc 10).',
      'Contagem por cliente do ERP, não por Party canônico (ver doc 09).',
    ],
    build: (ctx) => ({
      queries: [
        `SELECT COUNT(*) AS c FROM (SELECT DISTINCT a.cd_pessoa FROM nf a WHERE a.${INVOICE_DATE_FIELD} >= '${ctx.period_start}' AND a.${INVOICE_DATE_FIELD} < '${ctx.period_end}' AND a.fl_ent_sai = 'S' AND ISNULL(a.fl_can_nf, 'N') <> 'S' AND a.dt_cancelamento IS NULL AND a.dt_anul_nf IS NULL AND ISNULL(a.vl_faturamento,0) > 0${ctx.cd_empresa ? ` AND a.cd_empresa = '${String(ctx.cd_empresa).replace(/'/g, '')}'` : ''} AND NOT EXISTS (SELECT 1 FROM nf b WHERE b.cd_pessoa = a.cd_pessoa AND b.${INVOICE_DATE_FIELD} < '${ctx.period_start}' AND b.fl_ent_sai = 'S' AND ISNULL(b.fl_can_nf, 'N') <> 'S' AND b.dt_cancelamento IS NULL AND b.dt_anul_nf IS NULL AND ISNULL(b.vl_faturamento,0) > 0)) t`,
      ],
      reduce: ([r]) => Number(r?.[0]?.c || 0),
    }),
  },
];

// Universo canônico de recebíveis (mesmo usado no bloco analytics · CAR)
function carWindowClause(ctx: AnalysisContext, start: string, end: string) {
  const emp = ctx.cd_empresa ? ` AND cd_empresa_gestora = '${String(ctx.cd_empresa).replace(/'/g, '')}'` : '';
  return `dt_emi_car >= '${start}' AND dt_emi_car < '${end}' AND dt_cancelamento IS NULL${emp}`;
}

function periodDays(ctx: AnalysisContext) {
  const ms = new Date(ctx.period_end + 'T00:00:00Z').getTime() - new Date(ctx.period_start + 'T00:00:00Z').getTime();
  return Math.max(1, Math.round(ms / 86400000));
}

METRICS.push(
  {
    metric_id: 'MTR-020',
    business_name: 'Recebíveis em aberto (emitidos no período)',
    version: '0.1',
    formula: 'Σ vl_pre_car de títulos emitidos no período, não baixados e não cancelados',
    grain: 'receivable',
    unit: 'BRL',
    time_dimension: 'dt_emi_car',
    business_owner: PENDING_OWNER,
    technical_owner: 'Data Platform',
    source_of_truth: 'car.vl_pre_car (substituto do canônico Receivable)',
    trusted: false,
    blocking_questions: [
      'Confirmar se o saldo em aberto deve incluir acréscimos/descontos (vl_acr_car / vl_des_car).',
      'Recorte por emissão no período difere de posição de carteira (saldo em uma data).',
    ],
    build: (ctx) => ({
      queries: [
        `SELECT ISNULL(SUM(vl_pre_car),0) AS v FROM car WHERE ${carWindowClause(ctx, ctx.period_start, ctx.period_end)} AND dt_bai_car IS NULL`,
      ],
      reduce: ([r]) => Number(r?.[0]?.v || 0),
    }),
  },
  {
    metric_id: 'MTR-021',
    business_name: 'Recebíveis vencidos (emitidos no período)',
    version: '0.1',
    formula: 'Σ vl_pre_car de títulos emitidos no período, em aberto e com vencimento anterior a hoje',
    grain: 'receivable',
    unit: 'BRL',
    time_dimension: 'dt_emi_car',
    business_owner: PENDING_OWNER,
    technical_owner: 'Data Platform',
    source_of_truth: 'car.vl_pre_car + dt_ven_car',
    trusted: false,
    blocking_questions: ['Vencido depende da data corrente — resultado muda a cada execução (documentado por design).'],
    build: (ctx) => ({
      queries: [
        `SELECT ISNULL(SUM(vl_pre_car),0) AS v FROM car WHERE ${carWindowClause(ctx, ctx.period_start, ctx.period_end)} AND dt_bai_car IS NULL AND dt_ven_car < GETDATE()`,
      ],
      reduce: ([r]) => Number(r?.[0]?.v || 0),
    }),
  },
  {
    metric_id: 'MTR-022',
    business_name: 'DSO (prazo médio de recebimento)',
    version: '0.1',
    formula: '(Recebíveis em aberto emitidos no período / Receita do período) × dias da janela',
    grain: 'period',
    unit: 'count',
    time_dimension: 'dt_emi_car / dt_emi_nf',
    business_owner: PENDING_OWNER,
    technical_owner: 'Data Platform',
    source_of_truth: 'derivada de MTR-020 e MTR-001',
    trusted: false,
    blocking_questions: [
      ...REVENUE_BLOCKERS,
      'Método simples (não countback); confirmar convenção oficial com o financeiro.',
    ],
    build: (ctx) => ({
      queries: [
        `SELECT ISNULL(SUM(vl_pre_car),0) AS v FROM car WHERE ${carWindowClause(ctx, ctx.period_start, ctx.period_end)} AND dt_bai_car IS NULL`,
        `SELECT ${REVENUE_EXPR} AS v FROM nf WHERE ${windowClause(ctx, ctx.period_start, ctx.period_end)}`,
      ],
      reduce: ([open, rev]) => {
        const receita = Number(rev?.[0]?.v || 0);
        if (!receita) return null;
        return Math.round((Number(open?.[0]?.v || 0) / receita) * periodDays(ctx) * 10) / 10;
      },
    }),
  },
);

// Coorte de retenção 12m ancorada no fim do período (janela fixa de 12+12 meses).
function retentionCohortSql(ctx: AnalysisContext) {
  const d = (n: number) => {
    const x = new Date(ctx.period_end + 'T00:00:00Z');
    x.setUTCDate(x.getUTCDate() - n);
    return x.toISOString().slice(0, 10);
  };
  const d365 = d(365);
  return `SELECT
    SUM(CASE WHEN prior_cnt > 0 THEN 1 ELSE 0 END) AS base_,
    SUM(CASE WHEN prior_cnt > 0 AND cur_cnt > 0 THEN 1 ELSE 0 END) AS retained,
    SUM(CASE WHEN prior_cnt > 0 AND cur_cnt = 0 THEN 1 ELSE 0 END) AS churned
    FROM (SELECT cd_pessoa,
      SUM(CASE WHEN ${INVOICE_DATE_FIELD} < '${d365}' THEN 1 ELSE 0 END) AS prior_cnt,
      SUM(CASE WHEN ${INVOICE_DATE_FIELD} >= '${d365}' THEN 1 ELSE 0 END) AS cur_cnt
      FROM nf WHERE ${windowClause(ctx, d(730), ctx.period_end)} AND ISNULL(vl_faturamento,0) > 0
      GROUP BY cd_pessoa) t`;
}
const RETENTION_BLOCKERS = [
  'Janela fixa 12m vs 12m ancorada no fim do período de análise (não usa a duração do período).',
  'Atividade = NF emitida (lifecycle v1, doc 10); o motor legado usa remessa — divergência estrutural esperada.',
];

METRICS.push(
  {
    metric_id: 'MTR-023',
    business_name: 'Taxa de retenção 12m',
    version: '0.1',
    formula: 'clientes com NF nos 12m anteriores que também faturaram nos 12m finais / base da coorte',
    grain: 'customer',
    unit: 'percent',
    time_dimension: INVOICE_DATE_FIELD,
    business_owner: PENDING_OWNER,
    technical_owner: 'Data Platform',
    source_of_truth: 'nf (lifecycle v1 · doc 10)',
    trusted: false,
    blocking_questions: RETENTION_BLOCKERS,
    build: (ctx) => ({
      queries: [retentionCohortSql(ctx)],
      reduce: ([r]) => {
        const base = Number(r?.[0]?.base_ || 0);
        return base ? Math.round((Number(r?.[0]?.retained || 0) / base) * 10000) / 100 : null;
      },
    }),
  },
  {
    metric_id: 'MTR-024',
    business_name: 'Clientes perdidos 12m (churn)',
    version: '0.1',
    formula: 'clientes com NF nos 12m anteriores e nenhuma NF nos 12m finais da coorte',
    grain: 'customer',
    unit: 'count',
    time_dimension: INVOICE_DATE_FIELD,
    business_owner: PENDING_OWNER,
    technical_owner: 'Data Platform',
    source_of_truth: 'nf (lifecycle v1 · doc 10)',
    trusted: false,
    blocking_questions: RETENTION_BLOCKERS,
    build: (ctx) => ({
      queries: [retentionCohortSql(ctx)],
      reduce: ([r]) => Number(r?.[0]?.churned || 0),
    }),
  },
);

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