import { empFilter } from './empresaScope.ts';

export const RENTAL_CHURN_V4_VERSION = '4.0-candidate';
export const RENTAL_CHURN_V4_STATUS = 'RECONCILIATION_ONLY_NOT_TRUSTED';

export type RentalChurnV4Context = {
  asOfDate: string;
  inactivityMonths: number;
  periodStart: string;
  periodEnd: string; // exclusivo
  customerIds?: Array<string | number>;
};

function assertIso(value: string, field: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) throw new Error(`${field} deve estar em YYYY-MM-DD.`);
}

function shiftMonths(iso: string, months: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

function shiftDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function numericCustomerFilter(ids?: Array<string | number>) {
  if (!ids?.length) return '';
  const safe = [...new Set(ids.map((v) => String(v)).filter((v) => /^\d+$/.test(v)))];
  if (!safe.length) return ' AND 1 = 0';
  return ` AND f.cd_pessoa IN (${safe.join(',')})`;
}

export function normalizeRentalChurnV4Context(input: Partial<RentalChurnV4Context>): RentalChurnV4Context {
  const asOfDate = String(input.asOfDate || '').slice(0, 10);
  assertIso(asOfDate, 'as_of_date');
  const inactivityMonths = Number(input.inactivityMonths) > 0 ? Math.floor(Number(input.inactivityMonths)) : 13;
  const periodEnd = String(input.periodEnd || shiftDays(asOfDate, 1)).slice(0, 10);
  const periodStart = String(input.periodStart || `${asOfDate.slice(0, 7)}-01`).slice(0, 10);
  assertIso(periodStart, 'period_start');
  assertIso(periodEnd, 'period_end');
  if (periodStart >= periodEnd) throw new Error('period_start deve ser anterior a period_end.');
  return { asOfDate, inactivityMonths, periodStart, periodEnd, customerIds: input.customerIds || [] };
}

export function rentalChurnV4Dates(ctx: RentalChurnV4Context) {
  const analysisEnd = shiftDays(ctx.asOfDate, 1);
  const analysisStart = shiftMonths(analysisEnd, -ctx.inactivityMonths);
  const refStart = shiftMonths(analysisStart, -ctx.inactivityMonths);
  return {
    cutoff: shiftMonths(ctx.asOfDate, -ctx.inactivityMonths),
    analysisEnd,
    analysisStart,
    refStart,
  };
}

// CTEs comuns da v4. O objetivo é reproduzir o estado operacional observado no full log:
// ficha -> remessa/itens -> devolucao -> fatura -> NF vinculada.
// Importante: a NF de locacao nasce de fl_fatura.cd_nf/cd_nf_mo. Nesta fase de
// reconciliacao existem dois universos fiscais lado a lado:
//   basic = vinculada e nao cancelada/anulada;
//   canonical = basic + fl_ent_sai='S' (regra geral atual do Cerebro).
// A diferenca entre ambos e explicitamente medida; nao e resolvida silenciosamente.
export function buildRentalChurnV4Ctes(raw: RentalChurnV4Context) {
  const ctx = normalizeRentalChurnV4Context(raw);
  const dates = rentalChurnV4Dates(ctx);
  const customerFilter = numericCustomerFilter(ctx.customerIds);
  const companyFilter = empFilter('f');

  return `
WITH remessa_header AS (
  SELECT
    r.cd_controle,
    MIN(CASE WHEN r.dt_saida IS NOT NULL AND ISNULL(r.fl_rem_cancelada,'N') <> 'S' THEN r.dt_saida END) AS first_remessa,
    MAX(CASE WHEN r.dt_saida IS NOT NULL AND ISNULL(r.fl_rem_cancelada,'N') <> 'S' THEN r.dt_saida END) AS last_remessa,
    SUM(CASE WHEN ISNULL(r.fl_rem_cancelada,'N') <> 'S' AND r.dt_pedido IS NOT NULL AND r.dt_saida IS NULL THEN 1 ELSE 0 END) AS remessas_aprovadas_nao_expedidas,
    SUM(CASE WHEN ISNULL(r.fl_rem_cancelada,'N') <> 'S' AND (r.dt_pedido IS NULL OR r.dt_saida IS NULL) THEN 1 ELSE 0 END) AS remessas_em_andamento,
    SUM(CASE WHEN ISNULL(r.fl_rem_cancelada,'N') = 'S' THEN 1 ELSE 0 END) AS remessas_canceladas
  FROM fl_remessa r WITH (NOLOCK)
  GROUP BY r.cd_controle
),
remessa_items AS (
  SELECT
    r.cd_controle,
    SUM(CASE WHEN r.dt_saida IS NOT NULL AND ISNULL(r.fl_rem_cancelada,'N') <> 'S' THEN ISNULL(re.qt_remessa,0) ELSE 0 END) AS qt_remetida,
    SUM(CASE WHEN r.dt_saida IS NOT NULL AND ISNULL(r.fl_rem_cancelada,'N') <> 'S' THEN ISNULL(re.qt_devolucao,0) ELSE 0 END) AS qt_devolvida_atual,
    SUM(CASE WHEN r.dt_saida IS NOT NULL AND ISNULL(r.fl_rem_cancelada,'N') <> 'S'
      THEN CASE WHEN ISNULL(re.qt_remessa,0) > ISNULL(re.qt_devolucao,0)
        THEN ISNULL(re.qt_remessa,0) - ISNULL(re.qt_devolucao,0) ELSE 0 END
      ELSE 0 END) AS saldo_fisico_atual
  FROM fl_remessa r WITH (NOLOCK)
  INNER JOIN fl_rem_equ re WITH (NOLOCK) ON re.cd_flremessa = r.cd_flremessa
  GROUP BY r.cd_controle
),
devolucao_agg AS (
  SELECT
    d.cd_controle,
    SUM(CASE WHEN d.fl_operacao = 'D' AND ISNULL(d.fl_dev_cancelada,'N') <> 'S'
      AND (d.dt_pedido IS NULL OR d.dt_entrada IS NULL) THEN 1 ELSE 0 END) AS devolucoes_pendentes,
    SUM(CASE WHEN d.fl_operacao = 'D' AND ISNULL(d.fl_dev_cancelada,'N') <> 'S'
      AND d.dt_entrada IS NOT NULL THEN 1 ELSE 0 END) AS devolucoes_efetivadas,
    MAX(CASE WHEN d.fl_operacao = 'D' AND ISNULL(d.fl_dev_cancelada,'N') <> 'S' THEN d.dt_devolucao END) AS last_dt_devolucao,
    MAX(CASE WHEN d.fl_operacao = 'D' AND ISNULL(d.fl_dev_cancelada,'N') <> 'S' AND d.dt_entrada IS NOT NULL THEN d.dt_entrada END) AS last_dt_entrada
  FROM fl_devolucao d WITH (NOLOCK)
  GROUP BY d.cd_controle
),
fatura_agg AS (
  SELECT
    fat.cd_controle,
    COUNT(DISTINCT fat.cd_flfatura) AS fatura_count,
    MIN(fat.dt_geracao) AS first_fatura_geracao,
    MAX(fat.dt_geracao) AS last_fatura_geracao,
    MIN(COALESCE(fat.dt_inicio, fat.dt_geracao)) AS first_fatura_inicio,
    MAX(fat.dt_fim) AS last_fatura_fim,
    MAX(CASE WHEN fat.dt_inicio IS NOT NULL AND fat.dt_fim IS NOT NULL
      AND fat.dt_inicio <= '${ctx.asOfDate}' AND fat.dt_fim >= '${ctx.asOfDate}' THEN 1 ELSE 0 END) AS cobertura_faturada_vigente
  FROM fl_fatura fat WITH (NOLOCK)
  GROUP BY fat.cd_controle
),
linked_nf AS (
  SELECT DISTINCT
    fat.cd_controle,
    n.cd_nf,
    COALESCE(n.dt_emi_nf, v.dt_emissao) AS dt_nf,
    CASE WHEN ISNULL(CAST(n.fl_can_nf AS varchar(5)),'N') NOT IN ('S','1')
      AND n.dt_cancelamento IS NULL AND n.dt_anul_nf IS NULL THEN 1 ELSE 0 END AS valid_basic,
    CASE WHEN ISNULL(CAST(n.fl_can_nf AS varchar(5)),'N') NOT IN ('S','1')
      AND n.dt_cancelamento IS NULL AND n.dt_anul_nf IS NULL AND n.fl_ent_sai = 'S' THEN 1 ELSE 0 END AS valid_canonical
  FROM fl_fatura fat WITH (NOLOCK)
  INNER JOIN nf n WITH (NOLOCK) ON n.cd_nf = fat.cd_nf
  LEFT JOIN v_nf_emissao v WITH (NOLOCK) ON v.cd_nf = n.cd_nf
  WHERE fat.cd_nf IS NOT NULL

  UNION

  SELECT DISTINCT
    fat.cd_controle,
    n.cd_nf,
    COALESCE(n.dt_emi_nf, v.dt_emissao) AS dt_nf,
    CASE WHEN ISNULL(CAST(n.fl_can_nf AS varchar(5)),'N') NOT IN ('S','1')
      AND n.dt_cancelamento IS NULL AND n.dt_anul_nf IS NULL THEN 1 ELSE 0 END AS valid_basic,
    CASE WHEN ISNULL(CAST(n.fl_can_nf AS varchar(5)),'N') NOT IN ('S','1')
      AND n.dt_cancelamento IS NULL AND n.dt_anul_nf IS NULL AND n.fl_ent_sai = 'S' THEN 1 ELSE 0 END AS valid_canonical
  FROM fl_fatura fat WITH (NOLOCK)
  INNER JOIN nf n WITH (NOLOCK) ON n.cd_nf = fat.cd_nf_mo
  LEFT JOIN v_nf_emissao v WITH (NOLOCK) ON v.cd_nf = n.cd_nf
  WHERE fat.cd_nf_mo IS NOT NULL
),
nf_agg AS (
  SELECT
    cd_controle,
    COUNT(DISTINCT cd_nf) AS linked_nf_count,
    COUNT(DISTINCT CASE WHEN valid_basic = 1 THEN cd_nf END) AS valid_linked_nf_count,
    COUNT(DISTINCT CASE WHEN valid_canonical = 1 THEN cd_nf END) AS canonical_nf_count,
    MIN(CASE WHEN valid_basic = 1 THEN dt_nf END) AS first_valid_nf,
    MAX(CASE WHEN valid_basic = 1 THEN dt_nf END) AS last_valid_nf,
    MAX(CASE WHEN valid_canonical = 1 THEN dt_nf END) AS last_canonical_nf,
    MAX(CASE WHEN valid_canonical = 1 AND dt_nf >= '${dates.refStart}' AND dt_nf < '${dates.analysisEnd}' THEN dt_nf END) AS v3_contract_last_nf
  FROM linked_nf
  GROUP BY cd_controle
),
ficha_raw AS (
  SELECT
    f.cd_pessoa,
    f.cd_controle,
    f.cd_empresa,
    f.numero,
    f.dt_pedido,
    f.dt_fai_ficha,
    f.dt_faf_ficha,
    f.dt_enc_ficha,
    f.dt_prevista_devolucao,
    f.dt_fat_ficha,
    f.dt_fau_ficha,
    f.dt_suspensao,
    f.cd_calcfat,
    cf.ds_calcfat,
    cf.num_dias_periodo,
    ISNULL(rh.remessas_aprovadas_nao_expedidas,0) AS remessas_aprovadas_nao_expedidas,
    ISNULL(rh.remessas_em_andamento,0) AS remessas_em_andamento,
    ISNULL(rh.remessas_canceladas,0) AS remessas_canceladas,
    rh.first_remessa,
    rh.last_remessa,
    ISNULL(ri.qt_remetida,0) AS qt_remetida,
    ISNULL(ri.qt_devolvida_atual,0) AS qt_devolvida_atual,
    ISNULL(ri.saldo_fisico_atual,0) AS saldo_fisico_atual,
    ISNULL(da.devolucoes_pendentes,0) AS devolucoes_pendentes,
    ISNULL(da.devolucoes_efetivadas,0) AS devolucoes_efetivadas,
    da.last_dt_devolucao,
    da.last_dt_entrada,
    ISNULL(fa.fatura_count,0) AS fatura_count,
    fa.first_fatura_geracao,
    fa.last_fatura_geracao,
    fa.first_fatura_inicio,
    fa.last_fatura_fim,
    ISNULL(fa.cobertura_faturada_vigente,0) AS cobertura_faturada_vigente,
    ISNULL(na.linked_nf_count,0) AS linked_nf_count,
    ISNULL(na.valid_linked_nf_count,0) AS valid_linked_nf_count,
    ISNULL(na.canonical_nf_count,0) AS canonical_nf_count,
    na.first_valid_nf,
    na.last_valid_nf,
    na.last_canonical_nf,
    na.v3_contract_last_nf,
    CASE WHEN rh.last_remessa IS NOT NULL OR ISNULL(fa.fatura_count,0) > 0 THEN 1 ELSE 0 END AS ficha_ativada,
    CASE WHEN f.dt_enc_ficha IS NULL AND (rh.last_remessa IS NOT NULL OR na.v3_contract_last_nf IS NOT NULL) THEN 1 ELSE 0 END AS v3_ficha_aberta
  FROM fich_loc f WITH (NOLOCK)
  LEFT JOIN calcfat cf WITH (NOLOCK) ON cf.cd_calcfat = f.cd_calcfat
  LEFT JOIN remessa_header rh ON rh.cd_controle = f.cd_controle
  LEFT JOIN remessa_items ri ON ri.cd_controle = f.cd_controle
  LEFT JOIN devolucao_agg da ON da.cd_controle = f.cd_controle
  LEFT JOIN fatura_agg fa ON fa.cd_controle = f.cd_controle
  LEFT JOIN nf_agg na ON na.cd_controle = f.cd_controle
  WHERE f.cd_pessoa IS NOT NULL ${companyFilter}${customerFilter}
),
ficha_state AS (
  SELECT fr.*,
    CASE
      WHEN ficha_ativada = 0 AND remessas_em_andamento > 0 THEN 'PRE_OPERACIONAL'
      WHEN ficha_ativada = 0 THEN 'NAO_ATIVADA'
      WHEN dt_enc_ficha IS NOT NULL AND (saldo_fisico_atual > 0 OR devolucoes_pendentes > 0) THEN 'ENCERRADA_INCONSISTENTE'
      WHEN dt_enc_ficha IS NULL AND devolucoes_pendentes > 0 THEN 'DEVOLUCAO_EM_ANDAMENTO'
      WHEN dt_enc_ficha IS NULL AND saldo_fisico_atual > 0 THEN 'ATIVA_EM_CAMPO'
      WHEN dt_enc_ficha IS NULL AND dt_suspensao IS NOT NULL AND dt_suspensao >= '${ctx.asOfDate}' THEN 'SUSPENSA'
      WHEN dt_enc_ficha IS NULL AND (cobertura_faturada_vigente = 1 OR (dt_fat_ficha IS NOT NULL AND dt_fat_ficha >= '${ctx.asOfDate}')) THEN 'ATIVA_FATURAMENTO'
      WHEN dt_enc_ficha IS NULL THEN 'ABERTA_SEM_SALDO'
      ELSE 'ENCERRADA'
    END AS operational_state,
    CASE WHEN ficha_ativada = 1 AND dt_enc_ficha IS NULL
      AND (devolucoes_pendentes > 0 OR saldo_fisico_atual > 0 OR cobertura_faturada_vigente = 1
        OR (dt_suspensao IS NOT NULL AND dt_suspensao >= '${ctx.asOfDate}')
        OR (dt_fat_ficha IS NOT NULL AND dt_fat_ficha >= '${ctx.asOfDate}'))
      THEN 1 ELSE 0 END AS blocks_churn,
    CASE WHEN ficha_ativada = 1 AND (
        (dt_enc_ficha IS NOT NULL AND (saldo_fisico_atual > 0 OR devolucoes_pendentes > 0))
        OR (dt_enc_ficha IS NULL AND saldo_fisico_atual = 0 AND devolucoes_pendentes = 0
          AND cobertura_faturada_vigente = 0
          AND NOT (dt_suspensao IS NOT NULL AND dt_suspensao >= '${ctx.asOfDate}')
          AND NOT (dt_fat_ficha IS NOT NULL AND dt_fat_ficha >= '${ctx.asOfDate}'))
      ) THEN 1 ELSE 0 END AS operational_inconsistency
  FROM ficha_raw fr
),
activation_events AS (
  SELECT f.cd_pessoa, r.dt_saida AS dt_event
  FROM fl_remessa r WITH (NOLOCK)
  INNER JOIN fich_loc f WITH (NOLOCK) ON f.cd_controle = r.cd_controle
  WHERE r.dt_saida IS NOT NULL AND ISNULL(r.fl_rem_cancelada,'N') <> 'S'
    AND f.cd_pessoa IS NOT NULL ${empFilter('f')}${customerFilter}
  UNION ALL
  SELECT f.cd_pessoa, COALESCE(fat.dt_inicio, fat.dt_geracao) AS dt_event
  FROM fl_fatura fat WITH (NOLOCK)
  INNER JOIN fich_loc f WITH (NOLOCK) ON f.cd_controle = fat.cd_controle
  WHERE COALESCE(fat.dt_inicio, fat.dt_geracao) IS NOT NULL
    AND f.cd_pessoa IS NOT NULL ${empFilter('f')}${customerFilter}
),
client_activation AS (
  SELECT cd_pessoa, MIN(dt_event) AS first_activation_date, MAX(dt_event) AS last_activation_event
  FROM activation_events
  GROUP BY cd_pessoa
),
relationship_events AS (
  SELECT cd_pessoa, dt_enc_ficha AS dt_event, 'FICHA_ENCERRADA' AS event_type
  FROM ficha_state WHERE ficha_ativada = 1 AND dt_enc_ficha IS NOT NULL
  UNION ALL
  SELECT cd_pessoa, last_dt_entrada, 'DEVOLUCAO_ENTRADA'
  FROM ficha_state WHERE ficha_ativada = 1 AND last_dt_entrada IS NOT NULL
  UNION ALL
  SELECT cd_pessoa, last_fatura_fim, 'FATURA_FIM'
  FROM ficha_state WHERE ficha_ativada = 1 AND last_fatura_fim IS NOT NULL
  UNION ALL
  SELECT cd_pessoa, last_valid_nf, 'NF_LOCACAO'
  FROM ficha_state WHERE ficha_ativada = 1 AND last_valid_nf IS NOT NULL
),
client_end AS (
  SELECT cd_pessoa,
    MIN(dt_event) AS min_relationship_end_signal,
    MAX(dt_event) AS relationship_end_date
  FROM relationship_events
  GROUP BY cd_pessoa
),
v3_ref_events AS (
  SELECT f.cd_pessoa, r.dt_saida AS dt_event
  FROM fl_remessa r WITH (NOLOCK)
  INNER JOIN fich_loc f WITH (NOLOCK) ON f.cd_controle = r.cd_controle
  WHERE r.dt_saida IS NOT NULL AND ISNULL(r.fl_rem_cancelada,'N') <> 'S'
    AND r.dt_saida >= '${dates.refStart}' AND r.dt_saida < '${dates.analysisStart}'
    AND f.cd_pessoa IS NOT NULL ${empFilter('f')}${customerFilter}
  UNION
  SELECT fs.cd_pessoa, ln.dt_nf
  FROM linked_nf ln
  INNER JOIN ficha_state fs ON fs.cd_controle = ln.cd_controle
  WHERE ln.valid_canonical = 1 AND ln.dt_nf >= '${dates.refStart}' AND ln.dt_nf < '${dates.analysisStart}'
),
v3_ref_clients AS (
  SELECT cd_pessoa, COUNT(*) AS v3_ref_events
  FROM v3_ref_events GROUP BY cd_pessoa
),
customer_rollup AS (
  SELECT
    fs.cd_pessoa,
    COUNT(*) AS total_fichas,
    SUM(CASE WHEN fs.ficha_ativada = 1 THEN 1 ELSE 0 END) AS activated_fichas,
    SUM(CASE WHEN fs.blocks_churn = 1 THEN 1 ELSE 0 END) AS active_operational_fichas,
    SUM(CASE WHEN fs.operational_inconsistency = 1 THEN 1 ELSE 0 END) AS inconsistent_fichas,
    SUM(CASE WHEN fs.operational_state = 'PRE_OPERACIONAL' THEN 1 ELSE 0 END) AS pre_operational_fichas,
    SUM(CASE WHEN fs.operational_state = 'ABERTA_SEM_SALDO' THEN 1 ELSE 0 END) AS open_without_balance_fichas,
    SUM(CASE WHEN fs.operational_state = 'ENCERRADA_INCONSISTENTE' THEN 1 ELSE 0 END) AS closed_inconsistent_fichas,
    SUM(CASE WHEN fs.operational_state = 'ATIVA_EM_CAMPO' THEN 1 ELSE 0 END) AS active_in_field_fichas,
    SUM(CASE WHEN fs.operational_state = 'DEVOLUCAO_EM_ANDAMENTO' THEN 1 ELSE 0 END) AS return_in_progress_fichas,
    SUM(CASE WHEN fs.operational_state = 'ATIVA_FATURAMENTO' THEN 1 ELSE 0 END) AS active_billing_fichas,
    SUM(CASE WHEN fs.operational_state = 'SUSPENSA' THEN 1 ELSE 0 END) AS suspended_fichas,
    MAX(fs.dt_enc_ficha) AS last_ficha_closed,
    MAX(fs.last_dt_entrada) AS last_return_entry,
    MAX(fs.last_fatura_fim) AS last_billing_coverage_end,
    MAX(fs.last_valid_nf) AS last_valid_linked_nf,
    MAX(fs.last_canonical_nf) AS last_canonical_nf,
    SUM(fs.valid_linked_nf_count) AS valid_linked_nf_count,
    SUM(fs.canonical_nf_count) AS canonical_nf_count,
    MAX(fs.v3_ficha_aberta) AS v3_open_contract,
    MAX(fs.v3_contract_last_nf) AS v3_last_nf
  FROM ficha_state fs
  GROUP BY fs.cd_pessoa
)
`;
}

export function buildRentalChurnV4CustomerSql(raw: RentalChurnV4Context) {
  const ctx = normalizeRentalChurnV4Context(raw);
  const dates = rentalChurnV4Dates(ctx);
  const ctes = buildRentalChurnV4Ctes(ctx);

  return `${ctes}
SELECT
  cr.cd_pessoa,
  ca.first_activation_date,
  cr.total_fichas,
  cr.activated_fichas,
  cr.active_operational_fichas,
  cr.inconsistent_fichas,
  cr.pre_operational_fichas,
  cr.open_without_balance_fichas,
  cr.closed_inconsistent_fichas,
  cr.active_in_field_fichas,
  cr.return_in_progress_fichas,
  cr.active_billing_fichas,
  cr.suspended_fichas,
  cr.last_ficha_closed,
  cr.last_return_entry,
  cr.last_billing_coverage_end,
  cr.last_valid_linked_nf,
  cr.last_canonical_nf,
  cr.valid_linked_nf_count,
  cr.canonical_nf_count,
  ce.min_relationship_end_signal,
  ce.relationship_end_date,
  CASE WHEN ce.relationship_end_date IS NOT NULL THEN DATEDIFF(day, ce.relationship_end_date, '${ctx.asOfDate}') END AS days_since_relationship_end,
  CASE WHEN ce.min_relationship_end_signal IS NOT NULL AND ce.relationship_end_date IS NOT NULL
    THEN DATEDIFF(day, ce.min_relationship_end_signal, ce.relationship_end_date) END AS anchor_spread_days,
  CASE WHEN ce.min_relationship_end_signal IS NOT NULL AND ce.relationship_end_date IS NOT NULL
    AND DATEDIFF(day, ce.min_relationship_end_signal, ce.relationship_end_date) > 45 THEN 1 ELSE 0 END AS anchor_divergence_flag,
  CASE WHEN ce.relationship_end_date IS NOT NULL THEN DATEADD(month, ${ctx.inactivityMonths}, ce.relationship_end_date) END AS churn_date,
  CASE
    WHEN cr.activated_fichas = 0 THEN 'NAO_CLIENTE_LOCACAO'
    WHEN cr.active_operational_fichas > 0 AND cr.inconsistent_fichas > 0 THEN 'ATIVO_CONTRATO_COM_ALERTA'
    WHEN cr.active_operational_fichas > 0 THEN 'ATIVO_CONTRATO'
    WHEN cr.inconsistent_fichas > 0 THEN 'AUDITAR_ESTADO_OPERACIONAL'
    WHEN ce.relationship_end_date IS NULL THEN 'AUDITAR_SEM_DATA_FIM'
    WHEN DATEADD(month, ${ctx.inactivityMonths}, ce.relationship_end_date) <= '${ctx.asOfDate}' THEN 'CHURN_CONFIRMADO'
    ELSE 'ENCERRADO_PROTEGIDO'
  END AS v4_status,
  CASE
    WHEN cr.activated_fichas = 0 THEN 0
    WHEN cr.active_operational_fichas > 0 OR cr.inconsistent_fichas > 0 OR ce.relationship_end_date IS NULL THEN 0
    WHEN DATEADD(month, ${ctx.inactivityMonths}, ce.relationship_end_date) <= '${ctx.asOfDate}' THEN 1
    ELSE 0
  END AS v4_is_churned,
  CASE WHEN ISNULL(v3r.v3_ref_events,0) > 0 THEN 1 ELSE 0 END AS v3_population_member,
  CASE
    WHEN ISNULL(v3r.v3_ref_events,0) = 0 THEN 'FORA_DA_COORTE_V3'
    WHEN cr.v3_open_contract = 1 THEN 'ATIVO_CONTRATO'
    WHEN cr.v3_last_nf IS NULL THEN 'AUDITAR_SEM_NF'
    WHEN cr.v3_last_nf >= '${dates.analysisStart}' THEN 'ATIVO_RECENTE'
    ELSE 'CHURN_CONFIRMADO'
  END AS v3_status,
  CASE
    WHEN ISNULL(v3r.v3_ref_events,0) = 0 THEN NULL
    WHEN cr.v3_open_contract = 1 THEN 0
    WHEN cr.v3_last_nf IS NULL THEN 0
    WHEN cr.v3_last_nf >= '${dates.analysisStart}' THEN 0
    ELSE 1
  END AS v3_is_churned,
  CASE
    WHEN cr.activated_fichas > 0 AND ISNULL(v3r.v3_ref_events,0) = 0 THEN 'POPULACAO_V3_OMITE_CLIENTE_ATIVADO'
    WHEN cr.active_operational_fichas > 0 AND cr.inconsistent_fichas > 0 THEN 'V4_ATIVO_COM_INCONSISTENCIA'
    WHEN ISNULL(v3r.v3_ref_events,0) > 0 AND cr.v3_open_contract = 1
      AND cr.active_operational_fichas = 0 AND cr.open_without_balance_fichas > 0 THEN 'FICHA_ABERTA_STALE_V3_EXIGE_AUDITORIA'
    WHEN cr.inconsistent_fichas > 0 THEN 'AUDITORIA_OPERACIONAL_V4'
    WHEN ISNULL(v3r.v3_ref_events,0) > 0 AND cr.v3_open_contract = 0 AND cr.v3_last_nf IS NOT NULL
      AND cr.v3_last_nf < '${dates.analysisStart}' AND cr.active_operational_fichas > 0 THEN 'FALSO_CHURN_V3_CONTRATO_ATIVO'
    WHEN ISNULL(v3r.v3_ref_events,0) > 0 AND cr.v3_open_contract = 0 AND cr.v3_last_nf IS NOT NULL
      AND cr.v3_last_nf < '${dates.analysisStart}'
      AND ce.relationship_end_date IS NOT NULL
      AND DATEADD(month, ${ctx.inactivityMonths}, ce.relationship_end_date) > '${ctx.asOfDate}' THEN 'FALSO_CHURN_V3_ANCORA_TEMPORAL'
    WHEN ISNULL(v3r.v3_ref_events,0) > 0 AND cr.v3_last_nf IS NULL AND cr.valid_linked_nf_count > 0 THEN 'UNIVERSO_FISCAL_V3_EXCLUI_NF_VINCULADA'
    ELSE 'SEM_DIVERGENCIA_REGRA'
  END AS divergence_type,
  CASE WHEN cr.valid_linked_nf_count > cr.canonical_nf_count THEN 1 ELSE 0 END AS fiscal_universe_divergence
FROM customer_rollup cr
LEFT JOIN client_activation ca ON ca.cd_pessoa = cr.cd_pessoa
LEFT JOIN client_end ce ON ce.cd_pessoa = cr.cd_pessoa
LEFT JOIN v3_ref_clients v3r ON v3r.cd_pessoa = cr.cd_pessoa
ORDER BY cr.cd_pessoa`;
}

export function buildRentalChurnV4EpisodeSql(raw: RentalChurnV4Context) {
  const ctx = normalizeRentalChurnV4Context(raw);
  const ctes = buildRentalChurnV4Ctes(ctx);
  return `${ctes},
ficha_start_events AS (
  SELECT cd_pessoa, cd_controle, first_remessa AS dt_event FROM ficha_state WHERE ficha_ativada = 1 AND first_remessa IS NOT NULL
  UNION ALL
  SELECT cd_pessoa, cd_controle, first_fatura_inicio FROM ficha_state WHERE ficha_ativada = 1 AND first_fatura_inicio IS NOT NULL
  UNION ALL
  SELECT cd_pessoa, cd_controle, first_valid_nf FROM ficha_state WHERE ficha_ativada = 1 AND first_valid_nf IS NOT NULL
),
ficha_start AS (
  SELECT cd_pessoa, cd_controle, MIN(dt_event) AS interval_start
  FROM ficha_start_events GROUP BY cd_pessoa, cd_controle
),
ficha_end_events AS (
  SELECT cd_pessoa, cd_controle, dt_enc_ficha AS dt_event FROM ficha_state WHERE ficha_ativada = 1 AND dt_enc_ficha IS NOT NULL
  UNION ALL
  SELECT cd_pessoa, cd_controle, last_dt_entrada FROM ficha_state WHERE ficha_ativada = 1 AND last_dt_entrada IS NOT NULL
  UNION ALL
  SELECT cd_pessoa, cd_controle, last_fatura_fim FROM ficha_state WHERE ficha_ativada = 1 AND last_fatura_fim IS NOT NULL
  UNION ALL
  SELECT cd_pessoa, cd_controle, last_valid_nf FROM ficha_state WHERE ficha_ativada = 1 AND last_valid_nf IS NOT NULL
),
ficha_end AS (
  SELECT cd_pessoa, cd_controle, MAX(dt_event) AS interval_end
  FROM ficha_end_events GROUP BY cd_pessoa, cd_controle
),
clean_intervals AS (
  SELECT
    fs.cd_pessoa,
    fs.cd_controle,
    st.interval_start,
    CASE WHEN fs.blocks_churn = 1 THEN CAST('${ctx.asOfDate}' AS datetime) ELSE en.interval_end END AS interval_end
  FROM ficha_state fs
  INNER JOIN ficha_start st ON st.cd_controle = fs.cd_controle
  LEFT JOIN ficha_end en ON en.cd_controle = fs.cd_controle
  WHERE fs.ficha_ativada = 1
    AND fs.operational_inconsistency = 0
    AND st.interval_start IS NOT NULL
    AND (fs.blocks_churn = 1 OR en.interval_end IS NOT NULL)
),
ordered_intervals AS (
  SELECT ci.*,
    MAX(ci.interval_end) OVER (
      PARTITION BY ci.cd_pessoa
      ORDER BY ci.interval_start, ci.interval_end, ci.cd_controle
      ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
    ) AS prior_max_end
  FROM clean_intervals ci
),
island_flags AS (
  SELECT oi.*,
    CASE WHEN oi.prior_max_end IS NULL OR oi.interval_start > DATEADD(day,1,oi.prior_max_end) THEN 1 ELSE 0 END AS new_island
  FROM ordered_intervals oi
),
island_ids AS (
  SELECT f.*,
    SUM(f.new_island) OVER (
      PARTITION BY f.cd_pessoa
      ORDER BY f.interval_start, f.interval_end, f.cd_controle
      ROWS UNBOUNDED PRECEDING
    ) AS episode_id
  FROM island_flags f
),
episodes AS (
  SELECT cd_pessoa, episode_id, MIN(interval_start) AS episode_start, MAX(interval_end) AS episode_end,
    COUNT(*) AS fichas_no_episodio
  FROM island_ids
  GROUP BY cd_pessoa, episode_id
),
episode_seq AS (
  SELECT e.*,
    LEAD(e.episode_start) OVER (PARTITION BY e.cd_pessoa ORDER BY e.episode_start, e.episode_id) AS next_episode_start,
    DATEADD(month, ${ctx.inactivityMonths}, e.episode_end) AS candidate_churn_date
  FROM episodes e
),
episode_events AS (
  SELECT es.*,
    CASE WHEN es.candidate_churn_date <= '${ctx.asOfDate}'
      AND (es.next_episode_start IS NULL OR es.next_episode_start > es.candidate_churn_date)
      THEN 1 ELSE 0 END AS is_churn_event
  FROM episode_seq es
),
period_state_raw AS (
  SELECT
    ee.cd_pessoa,
    MIN(ee.episode_start) AS first_activation_date,
    MAX(CASE WHEN ee.episode_start <= '${ctx.periodStart}' THEN ee.episode_start END) AS latest_activation_before_period,
    MAX(CASE WHEN ee.is_churn_event = 1 AND ee.candidate_churn_date < '${ctx.periodStart}' THEN ee.candidate_churn_date END) AS latest_churn_before_period,
    SUM(CASE WHEN ee.is_churn_event = 1 AND ee.candidate_churn_date >= '${ctx.periodStart}' AND ee.candidate_churn_date < '${ctx.periodEnd}' THEN 1 ELSE 0 END) AS churn_events_in_period,
    MAX(CASE WHEN ee.is_churn_event = 1 AND ee.candidate_churn_date >= '${ctx.periodStart}' AND ee.candidate_churn_date < '${ctx.periodEnd}' THEN ee.candidate_churn_date END) AS last_churn_event_in_period
  FROM episode_events ee
  GROUP BY ee.cd_pessoa
),
period_state AS (
  SELECT ps.*,
    CASE WHEN ps.latest_activation_before_period IS NOT NULL
      AND (ps.latest_churn_before_period IS NULL OR ps.latest_activation_before_period > ps.latest_churn_before_period)
      THEN 1 ELSE 0 END AS eligible_at_period_start
  FROM period_state_raw ps
)
SELECT
  ee.cd_pessoa,
  ee.episode_id,
  ee.episode_start,
  ee.episode_end,
  ee.fichas_no_episodio,
  ee.next_episode_start,
  ee.candidate_churn_date,
  ee.is_churn_event,
  ps.first_activation_date,
  ps.latest_activation_before_period,
  ps.latest_churn_before_period,
  ps.eligible_at_period_start,
  ps.churn_events_in_period,
  ps.last_churn_event_in_period,
  cr.inconsistent_fichas AS current_inconsistent_fichas
FROM episode_events ee
INNER JOIN period_state ps ON ps.cd_pessoa = ee.cd_pessoa
INNER JOIN customer_rollup cr ON cr.cd_pessoa = ee.cd_pessoa
ORDER BY ee.cd_pessoa, ee.episode_start`;
}

export function buildRentalChurnV4FichaDetailSql(raw: RentalChurnV4Context) {
  const ctx = normalizeRentalChurnV4Context(raw);
  const ctes = buildRentalChurnV4Ctes(ctx);
  return `${ctes}
SELECT
  fs.cd_pessoa, fs.cd_controle, fs.cd_empresa, fs.numero,
  fs.operational_state, fs.ficha_ativada, fs.blocks_churn, fs.operational_inconsistency,
  fs.dt_pedido, fs.dt_fai_ficha, fs.dt_faf_ficha, fs.dt_enc_ficha,
  fs.dt_prevista_devolucao, fs.dt_fat_ficha, fs.dt_fau_ficha, fs.dt_suspensao,
  fs.cd_calcfat, fs.ds_calcfat, fs.num_dias_periodo,
  fs.first_remessa, fs.last_remessa,
  fs.remessas_aprovadas_nao_expedidas, fs.remessas_em_andamento, fs.remessas_canceladas,
  fs.qt_remetida, fs.qt_devolvida_atual, fs.saldo_fisico_atual,
  fs.devolucoes_pendentes, fs.devolucoes_efetivadas, fs.last_dt_devolucao, fs.last_dt_entrada,
  fs.fatura_count, fs.first_fatura_geracao, fs.last_fatura_geracao,
  fs.first_fatura_inicio, fs.last_fatura_fim, fs.cobertura_faturada_vigente,
  fs.linked_nf_count, fs.valid_linked_nf_count, fs.canonical_nf_count,
  fs.first_valid_nf, fs.last_valid_nf, fs.last_canonical_nf,
  fs.v3_ficha_aberta, fs.v3_contract_last_nf
FROM ficha_state fs
ORDER BY fs.cd_pessoa, fs.cd_controle`;
}
