import { empFilter } from './empresaScope.ts';

export const RENTAL_CHURN_V4_VERSION = '4.0-candidate';
export const RENTAL_CHURN_V4_STATUS = 'RECONCILIATION_ONLY_NOT_TRUSTED';

// Limite do wrapper DW_API (SISLOC): o texto SQL, já com aspas escapadas, não pode passar
// de 8.000 caracteres (parâmetro varchar(8000)). Medido em 2026-10-23: 7.900 ok, 8.100 falha.
export const DW_API_MAX_SQL_CHARS = 8000;

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
  return { cutoff: shiftMonths(ctx.asOfDate, -ctx.inactivityMonths), analysisEnd, analysisStart, refStart };
}

// A v4 é executada em etapas pequenas (cada SQL < 8.000 caracteres). O SQL só devolve
// agregados por ficha/cliente; estado operacional, rollup e episódios são calculados no
// backend (ver rentalChurnV4Engine.ts) com as mesmas regras da versão em SQL único.
// Escopo enxuto: só fichas reais (sem orçamento 'O') de clientes com atividade desde
// refStart ou ficha aberta.
export function buildRentalChurnV4StepSql(raw: RentalChurnV4Context): Record<string, string> {
  const ctx = normalizeRentalChurnV4Context(raw);
  const d = rentalChurnV4Dates(ctx);
  const cf = ` ${empFilter('f')}`;
  const cu = numericCustomerFilter(ctx.customerIds);
  const NL = `WITH (NOLOCK)`;
  const notCanc = `ISNULL(r.fl_rem_cancelada,'N')<>'S'`;
  const S = `WITH sc AS (SELECT DISTINCT f.cd_pessoa FROM fich_loc f ${NL} WHERE f.cd_pessoa IS NOT NULL AND ISNULL(f.tp_ope_pedido,'')<>'O' AND (f.dt_pedido>='${d.refStart}' OR f.dt_enc_ficha IS NULL OR f.dt_enc_ficha>='${d.refStart}')${cf}${cu}), sf AS (SELECT f.cd_controle FROM fich_loc f ${NL} JOIN sc ON sc.cd_pessoa=f.cd_pessoa WHERE ISNULL(f.tp_ope_pedido,'')<>'O'${cf})`;
  const nfValid = `ISNULL(CAST(n.fl_can_nf AS varchar(5)),'N') NOT IN ('S','1') AND n.dt_cancelamento IS NULL AND n.dt_anul_nf IS NULL`;
  const nfHalf = (col: string) => `SELECT fat.cd_controle, n.cd_nf, COALESCE(n.dt_emi_nf, v.dt_emissao) AS dt_nf, CASE WHEN ${nfValid} THEN 1 ELSE 0 END AS vb, CASE WHEN ${nfValid} AND n.fl_ent_sai='S' THEN 1 ELSE 0 END AS vc FROM fl_fatura fat ${NL} JOIN sf ON sf.cd_controle=fat.cd_controle JOIN nf n ${NL} ON n.cd_nf=fat.${col} LEFT JOIN v_nf_emissao v ${NL} ON v.cd_nf=n.cd_nf WHERE fat.${col} IS NOT NULL`;
  const okRem = `r.dt_saida IS NOT NULL AND ${notCanc}`;
  const devOk = `d.fl_operacao='D' AND ISNULL(d.fl_dev_cancelada,'N')<>'S'`;

  return {
    fichas: `${S} SELECT f.cd_pessoa, f.cd_controle, f.cd_empresa, f.numero, f.dt_pedido, f.dt_fai_ficha, f.dt_faf_ficha, f.dt_enc_ficha, f.dt_prevista_devolucao, f.dt_fat_ficha, f.dt_fau_ficha, f.dt_suspensao, f.cd_calcfat, cf.ds_calcfat, cf.num_dias_periodo FROM fich_loc f ${NL} JOIN sf ON sf.cd_controle=f.cd_controle LEFT JOIN calcfat cf ${NL} ON cf.cd_calcfat=f.cd_calcfat WHERE f.cd_pessoa IS NOT NULL`,
    remessa_header: `${S} SELECT r.cd_controle, MIN(CASE WHEN ${okRem} THEN r.dt_saida END) AS first_remessa, MAX(CASE WHEN ${okRem} THEN r.dt_saida END) AS last_remessa, SUM(CASE WHEN ${notCanc} AND r.dt_pedido IS NOT NULL AND r.dt_saida IS NULL THEN 1 ELSE 0 END) AS remessas_aprovadas_nao_expedidas, SUM(CASE WHEN ${notCanc} AND (r.dt_pedido IS NULL OR r.dt_saida IS NULL) THEN 1 ELSE 0 END) AS remessas_em_andamento, SUM(CASE WHEN ISNULL(r.fl_rem_cancelada,'N')='S' THEN 1 ELSE 0 END) AS remessas_canceladas FROM fl_remessa r ${NL} JOIN sf ON sf.cd_controle=r.cd_controle GROUP BY r.cd_controle`,
    remessa_items: `${S} SELECT r.cd_controle, SUM(CASE WHEN ${okRem} THEN ISNULL(re.qt_remessa,0) ELSE 0 END) AS qt_remetida, SUM(CASE WHEN ${okRem} THEN ISNULL(re.qt_devolucao,0) ELSE 0 END) AS qt_devolvida_atual, SUM(CASE WHEN ${okRem} AND ISNULL(re.qt_remessa,0)>ISNULL(re.qt_devolucao,0) THEN ISNULL(re.qt_remessa,0)-ISNULL(re.qt_devolucao,0) ELSE 0 END) AS saldo_fisico_atual FROM fl_remessa r ${NL} JOIN fl_rem_equ re ${NL} ON re.cd_flremessa=r.cd_flremessa JOIN sf ON sf.cd_controle=r.cd_controle GROUP BY r.cd_controle`,
    devolucao: `${S} SELECT d.cd_controle, SUM(CASE WHEN ${devOk} AND (d.dt_pedido IS NULL OR d.dt_entrada IS NULL) THEN 1 ELSE 0 END) AS devolucoes_pendentes, SUM(CASE WHEN ${devOk} AND d.dt_entrada IS NOT NULL THEN 1 ELSE 0 END) AS devolucoes_efetivadas, MAX(CASE WHEN ${devOk} THEN d.dt_devolucao END) AS last_dt_devolucao, MAX(CASE WHEN ${devOk} AND d.dt_entrada IS NOT NULL THEN d.dt_entrada END) AS last_dt_entrada FROM fl_devolucao d ${NL} JOIN sf ON sf.cd_controle=d.cd_controle GROUP BY d.cd_controle`,
    fatura: `${S} SELECT fat.cd_controle, COUNT(DISTINCT fat.cd_flfatura) AS fatura_count, MIN(fat.dt_geracao) AS first_fatura_geracao, MAX(fat.dt_geracao) AS last_fatura_geracao, MIN(COALESCE(fat.dt_inicio, fat.dt_geracao)) AS first_fatura_inicio, MAX(fat.dt_fim) AS last_fatura_fim, MAX(CASE WHEN fat.dt_inicio IS NOT NULL AND fat.dt_fim IS NOT NULL AND fat.dt_inicio<='${ctx.asOfDate}' AND fat.dt_fim>='${ctx.asOfDate}' THEN 1 ELSE 0 END) AS cobertura_faturada_vigente FROM fl_fatura fat ${NL} JOIN sf ON sf.cd_controle=fat.cd_controle GROUP BY fat.cd_controle`,
    nf: `${S}, ln AS (${nfHalf('cd_nf')} UNION ${nfHalf('cd_nf_mo')}) SELECT cd_controle, COUNT(DISTINCT cd_nf) AS linked_nf_count, COUNT(DISTINCT CASE WHEN vb=1 THEN cd_nf END) AS valid_linked_nf_count, COUNT(DISTINCT CASE WHEN vc=1 THEN cd_nf END) AS canonical_nf_count, MIN(CASE WHEN vb=1 THEN dt_nf END) AS first_valid_nf, MAX(CASE WHEN vb=1 THEN dt_nf END) AS last_valid_nf, MAX(CASE WHEN vc=1 THEN dt_nf END) AS last_canonical_nf, MAX(CASE WHEN vc=1 AND dt_nf>='${d.refStart}' AND dt_nf<'${d.analysisEnd}' THEN dt_nf END) AS v3_contract_last_nf, COUNT(DISTINCT CASE WHEN vc=1 AND dt_nf>='${d.refStart}' AND dt_nf<'${d.analysisStart}' THEN dt_nf END) AS v3_ref_nf_events FROM ln GROUP BY cd_controle`,
    activation: `${S}, ev AS (SELECT f.cd_pessoa, r.dt_saida AS d FROM fl_remessa r ${NL} JOIN fich_loc f ${NL} ON f.cd_controle=r.cd_controle JOIN sc ON sc.cd_pessoa=f.cd_pessoa WHERE ${okRem}${cf} UNION ALL SELECT f.cd_pessoa, COALESCE(fat.dt_inicio, fat.dt_geracao) FROM fl_fatura fat ${NL} JOIN fich_loc f ${NL} ON f.cd_controle=fat.cd_controle JOIN sc ON sc.cd_pessoa=f.cd_pessoa WHERE COALESCE(fat.dt_inicio, fat.dt_geracao) IS NOT NULL${cf}) SELECT cd_pessoa, MIN(d) AS first_activation_date, MAX(d) AS last_activation_event FROM ev GROUP BY cd_pessoa`,
    v3_ref_remessa: `${S} SELECT f.cd_pessoa, COUNT(DISTINCT r.dt_saida) AS n FROM fl_remessa r ${NL} JOIN fich_loc f ${NL} ON f.cd_controle=r.cd_controle JOIN sc ON sc.cd_pessoa=f.cd_pessoa WHERE ${okRem} AND r.dt_saida>='${d.refStart}' AND r.dt_saida<'${d.analysisStart}'${cf} GROUP BY f.cd_pessoa`,
  };
}