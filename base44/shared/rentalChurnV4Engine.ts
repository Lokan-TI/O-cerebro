import { buildRentalChurnV4StepSql, DW_API_MAX_SQL_CHARS, normalizeRentalChurnV4Context, rentalChurnV4Dates, type RentalChurnV4Context } from './rentalChurnV4.ts';

// Motor da v4 em memória: recebe os agregados por ficha (etapas SQL pequenas) e reproduz
// as regras que antes rodavam num SQL único (ficha_state, customer_rollup, episódios).

const DAY = 86400000;
type RunStep = (step: string, sql: string) => Promise<any[]>;

const ms = (v: any): number | null => {
  if (v == null || v === '') return null;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
};
const isoOut = (t: number | null) => (t == null ? null : new Date(t).toISOString());
const num = (v: any) => Number(v) || 0;
const dayNum = (t: number) => Math.floor(t / DAY);
const maxOf = (...xs: (number | null)[]) => xs.reduce<number | null>((a, b) => (b == null ? a : a == null || b > a ? b : a), null);
const minOf = (...xs: (number | null)[]) => xs.reduce<number | null>((a, b) => (b == null ? a : a == null || b < a ? b : a), null);

// Equivalente a DATEADD(month, n, d) do SQL Server (ajusta para o último dia do mês).
function addMonths(t: number, n: number) {
  const d = new Date(t);
  const y = d.getUTCFullYear(), m = d.getUTCMonth() + n;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return Date.UTC(y, m, Math.min(d.getUTCDate(), last), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds());
}

const byKey = (rows: any[], key: string) => new Map(rows.map((r) => [String(r[key]), r]));

function fichaState(f: any, A: number) {
  const ativada = f.last_remessa != null || num(f.fatura_count) > 0;
  const enc = ms(f.dt_enc_ficha);
  const saldo = num(f.saldo_fisico_atual), devp = num(f.devolucoes_pendentes), cob = num(f.cobertura_faturada_vigente);
  const susp = ms(f.dt_suspensao) != null && ms(f.dt_suspensao)! >= A;
  const fatFut = ms(f.dt_fat_ficha) != null && ms(f.dt_fat_ficha)! >= A;
  let st = 'ENCERRADA';
  if (!ativada && num(f.remessas_em_andamento) > 0) st = 'PRE_OPERACIONAL';
  else if (!ativada) st = 'NAO_ATIVADA';
  else if (enc != null && (saldo > 0 || devp > 0)) st = 'ENCERRADA_INCONSISTENTE';
  else if (enc == null && devp > 0) st = 'DEVOLUCAO_EM_ANDAMENTO';
  else if (enc == null && saldo > 0) st = 'ATIVA_EM_CAMPO';
  else if (enc == null && susp) st = 'SUSPENSA';
  else if (enc == null && (cob === 1 || fatFut)) st = 'ATIVA_FATURAMENTO';
  else if (enc == null) st = 'ABERTA_SEM_SALDO';
  const blocks = ativada && enc == null && (devp > 0 || saldo > 0 || cob === 1 || susp || fatFut);
  const incons = ativada && ((enc != null && (saldo > 0 || devp > 0)) || (enc == null && saldo === 0 && devp === 0 && cob === 0 && !susp && !fatFut));
  return {
    ...f,
    ficha_ativada: ativada ? 1 : 0,
    v3_ficha_aberta: enc == null && (f.last_remessa != null || f.v3_contract_last_nf != null) ? 1 : 0,
    operational_state: st, blocks_churn: blocks ? 1 : 0, operational_inconsistency: incons ? 1 : 0,
  };
}

export async function runRentalChurnV4(raw: RentalChurnV4Context, run: RunStep) {
  const ctx = normalizeRentalChurnV4Context(raw);
  const d = rentalChurnV4Dates(ctx);
  const sqls = buildRentalChurnV4StepSql(ctx);
  const sql_lengths: Record<string, number> = {};
  const res: Record<string, any[]> = {};
  for (const [step, sql] of Object.entries(sqls)) {
    const compact = sql.replace(/\s+/g, ' ').trim();
    sql_lengths[step] = compact.replace(/'/g, "''").length;
    if (sql_lengths[step] > DW_API_MAX_SQL_CHARS) throw new Error(`Etapa ${step}: SQL com ${sql_lengths[step]} caracteres excede o limite DW_API (${DW_API_MAX_SQL_CHARS}).`);
    res[step] = await run(step, compact);
  }

  const A = ms(`${ctx.asOfDate}T00:00:00Z`)!;
  const aStart = ms(`${d.analysisStart}T00:00:00Z`)!;
  const P0 = ms(`${ctx.periodStart}T00:00:00Z`)!, P1 = ms(`${ctx.periodEnd}T00:00:00Z`)!;
  const N = ctx.inactivityMonths;
  const joins = ['remessa_header', 'remessa_items', 'devolucao', 'fatura', 'nf'].map((k) => byKey(res[k], 'cd_controle'));

  const fichas = res.fichas.map((f) => {
    const k = String(f.cd_controle);
    const merged: any = { ...f };
    for (const j of joins) Object.assign(merged, j.get(k) || {});
    return fichaState(merged, A);
  });

  const activation = byKey(res.activation, 'cd_pessoa');
  const v3Rem = byKey(res.v3_ref_remessa, 'cd_pessoa');
  const byCust = new Map<string, any[]>();
  for (const f of fichas) { const k = String(f.cd_pessoa); (byCust.get(k) || byCust.set(k, []).get(k)!).push(f); }

  const customerRows: any[] = [];
  const episodeRows: any[] = [];
  const countState = (fs: any[], s: string) => fs.filter((f) => f.operational_state === s).length;

  for (const [k, fs] of [...byCust.entries()].sort((a, b) => Number(a[0]) - Number(b[0]))) {
    const act = fs.filter((f) => f.ficha_ativada === 1);
    const cr = {
      total_fichas: fs.length,
      activated_fichas: act.length,
      active_operational_fichas: fs.filter((f) => f.blocks_churn === 1).length,
      inconsistent_fichas: fs.filter((f) => f.operational_inconsistency === 1).length,
      open_without_balance_fichas: countState(fs, 'ABERTA_SEM_SALDO'),
      v3_open_contract: fs.some((f) => f.v3_ficha_aberta === 1) ? 1 : 0,
      v3_last_nf: maxOf(...fs.map((f) => ms(f.v3_contract_last_nf))),
      valid_linked_nf_count: fs.reduce((s, f) => s + num(f.valid_linked_nf_count), 0),
      canonical_nf_count: fs.reduce((s, f) => s + num(f.canonical_nf_count), 0),
    };
    const relEvents = act.flatMap((f) => [ms(f.dt_enc_ficha), ms(f.last_dt_entrada), ms(f.last_fatura_fim), ms(f.last_valid_nf)]);
    const relMin = minOf(...relEvents), relEnd = maxOf(...relEvents);
    const churnDate = relEnd != null ? addMonths(relEnd, N) : null;
    const v3Ref = num(v3Rem.get(k)?.n) + fs.reduce((s, f) => s + num(f.v3_ref_nf_events), 0);
    const inV3 = v3Ref > 0;

    let v4_status = 'ENCERRADO_PROTEGIDO';
    if (cr.activated_fichas === 0) v4_status = 'NAO_CLIENTE_LOCACAO';
    else if (cr.active_operational_fichas > 0 && cr.inconsistent_fichas > 0) v4_status = 'ATIVO_CONTRATO_COM_ALERTA';
    else if (cr.active_operational_fichas > 0) v4_status = 'ATIVO_CONTRATO';
    else if (cr.inconsistent_fichas > 0) v4_status = 'AUDITAR_ESTADO_OPERACIONAL';
    else if (relEnd == null) v4_status = 'AUDITAR_SEM_DATA_FIM';
    else if (churnDate! <= A) v4_status = 'CHURN_CONFIRMADO';

    let v3_status = 'CHURN_CONFIRMADO';
    if (!inV3) v3_status = 'FORA_DA_COORTE_V3';
    else if (cr.v3_open_contract === 1) v3_status = 'ATIVO_CONTRATO';
    else if (cr.v3_last_nf == null) v3_status = 'AUDITAR_SEM_NF';
    else if (cr.v3_last_nf >= aStart) v3_status = 'ATIVO_RECENTE';

    const v3OldNf = inV3 && cr.v3_open_contract === 0 && cr.v3_last_nf != null && cr.v3_last_nf < aStart;
    let divergence_type = 'SEM_DIVERGENCIA_REGRA';
    if (cr.activated_fichas > 0 && !inV3) divergence_type = 'POPULACAO_V3_OMITE_CLIENTE_ATIVADO';
    else if (cr.active_operational_fichas > 0 && cr.inconsistent_fichas > 0) divergence_type = 'V4_ATIVO_COM_INCONSISTENCIA';
    else if (inV3 && cr.v3_open_contract === 1 && cr.active_operational_fichas === 0 && cr.open_without_balance_fichas > 0) divergence_type = 'FICHA_ABERTA_STALE_V3_EXIGE_AUDITORIA';
    else if (cr.inconsistent_fichas > 0) divergence_type = 'AUDITORIA_OPERACIONAL_V4';
    else if (v3OldNf && cr.active_operational_fichas > 0) divergence_type = 'FALSO_CHURN_V3_CONTRATO_ATIVO';
    else if (v3OldNf && relEnd != null && churnDate! > A) divergence_type = 'FALSO_CHURN_V3_ANCORA_TEMPORAL';
    else if (inV3 && cr.v3_last_nf == null && cr.valid_linked_nf_count > 0) divergence_type = 'UNIVERSO_FISCAL_V3_EXCLUI_NF_VINCULADA';

    const a = activation.get(k) || {};
    customerRows.push({
      cd_pessoa: fs[0].cd_pessoa,
      first_activation_date: a.first_activation_date ?? null,
      total_fichas: cr.total_fichas, activated_fichas: cr.activated_fichas,
      active_operational_fichas: cr.active_operational_fichas, inconsistent_fichas: cr.inconsistent_fichas,
      pre_operational_fichas: countState(fs, 'PRE_OPERACIONAL'),
      open_without_balance_fichas: cr.open_without_balance_fichas,
      closed_inconsistent_fichas: countState(fs, 'ENCERRADA_INCONSISTENTE'),
      active_in_field_fichas: countState(fs, 'ATIVA_EM_CAMPO'),
      return_in_progress_fichas: countState(fs, 'DEVOLUCAO_EM_ANDAMENTO'),
      active_billing_fichas: countState(fs, 'ATIVA_FATURAMENTO'),
      suspended_fichas: countState(fs, 'SUSPENSA'),
      last_ficha_closed: isoOut(maxOf(...fs.map((f) => ms(f.dt_enc_ficha)))),
      last_return_entry: isoOut(maxOf(...fs.map((f) => ms(f.last_dt_entrada)))),
      last_billing_coverage_end: isoOut(maxOf(...fs.map((f) => ms(f.last_fatura_fim)))),
      last_valid_linked_nf: isoOut(maxOf(...fs.map((f) => ms(f.last_valid_nf)))),
      last_canonical_nf: isoOut(maxOf(...fs.map((f) => ms(f.last_canonical_nf)))),
      valid_linked_nf_count: cr.valid_linked_nf_count, canonical_nf_count: cr.canonical_nf_count,
      min_relationship_end_signal: isoOut(relMin), relationship_end_date: isoOut(relEnd),
      days_since_relationship_end: relEnd != null ? dayNum(A) - dayNum(relEnd) : null,
      anchor_spread_days: relMin != null && relEnd != null ? dayNum(relEnd) - dayNum(relMin) : null,
      anchor_divergence_flag: relMin != null && relEnd != null && dayNum(relEnd) - dayNum(relMin) > 45 ? 1 : 0,
      churn_date: isoOut(churnDate),
      v4_status,
      v4_is_churned: v4_status === 'CHURN_CONFIRMADO' ? 1 : 0,
      v3_population_member: inV3 ? 1 : 0,
      v3_status,
      v3_is_churned: !inV3 ? null : v3_status === 'CHURN_CONFIRMADO' ? 1 : 0,
      divergence_type,
      fiscal_universe_divergence: cr.valid_linked_nf_count > cr.canonical_nf_count ? 1 : 0,
    });

    // Episódios: intervalos de fichas ativadas e consistentes, unidos quando se sobrepõem.
    const intervals = act.filter((f) => f.operational_inconsistency === 0).map((f) => {
      const start = minOf(ms(f.first_remessa), ms(f.first_fatura_inicio), ms(f.first_valid_nf));
      const end = f.blocks_churn === 1 ? A : maxOf(ms(f.dt_enc_ficha), ms(f.last_dt_entrada), ms(f.last_fatura_fim), ms(f.last_valid_nf));
      return { start, end, ctl: Number(f.cd_controle) };
    }).filter((i) => i.start != null && i.end != null) as { start: number; end: number; ctl: number }[];
    intervals.sort((x, y) => x.start - y.start || x.end - y.end || x.ctl - y.ctl);
    const eps: { start: number; end: number; n: number }[] = [];
    let priorMax: number | null = null;
    for (const i of intervals) {
      if (priorMax == null || i.start > priorMax + DAY) eps.push({ start: i.start, end: i.end, n: 1 });
      else { const e = eps[eps.length - 1]; e.end = Math.max(e.end, i.end); e.n++; }
      priorMax = priorMax == null ? i.end : Math.max(priorMax, i.end);
    }
    if (!eps.length) continue;
    const evs = eps.map((e, idx) => {
      const next = eps[idx + 1]?.start ?? null;
      const cand = addMonths(e.end, N);
      return { ...e, id: idx + 1, next, cand, churn: cand <= A && (next == null || next > cand) ? 1 : 0 };
    });
    const lab = maxOf(...evs.map((e) => (e.start <= P0 ? e.start : null)));
    const lcb = maxOf(...evs.map((e) => (e.churn && e.cand < P0 ? e.cand : null)));
    const inPeriod = evs.filter((e) => e.churn && e.cand >= P0 && e.cand < P1);
    const ps = {
      first_activation_date: isoOut(evs[0].start),
      latest_activation_before_period: isoOut(lab),
      latest_churn_before_period: isoOut(lcb),
      eligible_at_period_start: lab != null && (lcb == null || lab > lcb) ? 1 : 0,
      churn_events_in_period: inPeriod.length,
      last_churn_event_in_period: isoOut(maxOf(...inPeriod.map((e) => e.cand))),
      current_inconsistent_fichas: cr.inconsistent_fichas,
    };
    for (const e of evs) {
      episodeRows.push({
        cd_pessoa: fs[0].cd_pessoa, episode_id: e.id, episode_start: isoOut(e.start), episode_end: isoOut(e.end),
        fichas_no_episodio: e.n, next_episode_start: isoOut(e.next), candidate_churn_date: isoOut(e.cand),
        is_churn_event: e.churn, ...ps,
      });
    }
  }

  return { customerRows, episodeRows, fichas, sql_lengths };
}