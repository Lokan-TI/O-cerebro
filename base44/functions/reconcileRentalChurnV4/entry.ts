import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { execRead } from '../../shared/erpConnection.ts';
import {
  RENTAL_CHURN_V4_STATUS,
  RENTAL_CHURN_V4_VERSION,
  buildRentalChurnV4CustomerSql,
  buildRentalChurnV4EpisodeSql,
  buildRentalChurnV4FichaDetailSql,
  normalizeRentalChurnV4Context,
  rentalChurnV4Dates,
} from '../../shared/rentalChurnV4.ts';

function rowsOf(result: any) {
  return Array.isArray(result?.recordset) ? result.recordset : [];
}

function iso(value: any) {
  if (!value) return null;
  try { return new Date(value).toISOString().slice(0, 10); } catch { return null; }
}

function statusFamilyV4(status: string) {
  if (status === 'CHURN_CONFIRMADO') return 'churn';
  if (status === 'ATIVO_CONTRATO' || status === 'ATIVO_CONTRATO_COM_ALERTA') return 'active';
  if (status === 'ENCERRADO_PROTEGIDO') return 'retained';
  if (status === 'NAO_CLIENTE_LOCACAO') return 'not_customer';
  return 'audit';
}

function statusFamilyV3(status: string) {
  if (status === 'CHURN_CONFIRMADO') return 'churn';
  if (status === 'ATIVO_CONTRATO' || status === 'ATIVO_RECENTE') return 'retained';
  if (status === 'FORA_DA_COORTE_V3') return 'excluded';
  return 'audit';
}

const DIVERGENCE_EXPLANATIONS: Record<string, string> = {
  POPULACAO_V3_OMITE_CLIENTE_ATIVADO: 'Cliente historicamente ativado existe no snapshot v4, mas não entra na coorte histórica usada pelo motor v3.',
  V4_ATIVO_COM_INCONSISTENCIA: 'Existe ao menos uma ficha que bloqueia churn e, simultaneamente, outra evidência operacional inconsistente. Cliente continua ativo, mas exige auditoria.',
  AUDITORIA_OPERACIONAL_V4: 'Remessa, saldo, devolução ou encerramento persistido apresentam sinais contraditórios; a v4 não força churn.',
  FALSO_CHURN_V3_CONTRATO_ATIVO: 'O v3 pode considerar churn pela NF antiga, mas a v4 encontrou ficha operacionalmente ativa por saldo/devolução/faturamento.',
  FALSO_CHURN_V3_ANCORA_TEMPORAL: 'A última NF antecede o fim real do relacionamento; o relógio v4 começa no relationship_end_date e ainda está dentro da proteção.',
  FICHA_ABERTA_STALE_V3_EXIGE_AUDITORIA: 'O v3 protege por ficha sem dt_enc_ficha, mas a v4 não encontrou saldo, devolução pendente, cobertura ou próxima geração que comprovem atividade; o caso vai para auditoria, não para churn automático.',
  UNIVERSO_FISCAL_V3_EXCLUI_NF_VINCULADA: 'Existe NF vinculada à fl_fatura e não cancelada/anulada que não entrou no universo fiscal genérico usado pelo v3.',
  SEM_DIVERGENCIA_REGRA: 'Nenhuma divergência automática de regra identificada.',
};

function daysBetween(a: string | null, b: string | null) {
  if (!a || !b) return null;
  const av = new Date(`${a}T00:00:00Z`).getTime();
  const bv = new Date(`${b}T00:00:00Z`).getTime();
  if (!Number.isFinite(av) || !Number.isFinite(bv)) return null;
  return Math.floor((bv - av) / 86400000);
}

function buildDirectedAuditCandidates(rows: any[], asOfDate: string) {
  const out: any[] = [];
  const seen = new Set<string>();
  const add = (caseType: string, row: any, priority: number) => {
    if (!row?.cd_pessoa) return;
    const key = `${caseType}:${row.cd_pessoa}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ case_type: caseType, priority, row });
  };
  const addWhere = (caseType: string, predicate: (r: any) => boolean, priority: number, limit = 3) => {
    let n = 0;
    for (const row of rows) {
      if (!predicate(row)) continue;
      add(caseType, row, priority);
      if (++n >= limit) break;
    }
  };

  // Caso do full log que originou a reconstrução da máquina de estado.
  const fullLog = rows.find((r: any) => String(r.cd_pessoa) === '13442');
  if (fullLog) add('FULL_LOG_GROUND_TRUTH_676399', fullLog, 120);

  addWhere('FALSO_CHURN_V3_CONTRATO_ATIVO', (r) => r.divergence_type === 'FALSO_CHURN_V3_CONTRATO_ATIVO', 110, 5);
  addWhere('FALSO_CHURN_V3_ANCORA_TEMPORAL', (r) => r.divergence_type === 'FALSO_CHURN_V3_ANCORA_TEMPORAL', 105, 5);
  addWhere('FICHA_ABERTA_STALE', (r) => r.divergence_type === 'FICHA_ABERTA_STALE_V3_EXIGE_AUDITORIA', 100, 5);
  addWhere('INCONSISTENCIA_OPERACIONAL', (r) => Number(r.inconsistent_fichas) > 0, 95, 5);
  addWhere('UNIVERSO_FISCAL_DIVERGENTE', (r) => Number(r.fiscal_universe_divergence) === 1, 90, 5);
  addWhere('MULTIPLAS_FICHAS_UMA_ATIVA', (r) => Number(r.activated_fichas) >= 2 && Number(r.active_operational_fichas) >= 1, 80, 3);
  addWhere('ATIVO_CONTRATO_CONTROLE', (r) => r.v4_status === 'ATIVO_CONTRATO' && Number(r.inconsistent_fichas) === 0, 70, 3);
  addWhere('ENCERRADO_PROTEGIDO_CONTROLE', (r) => r.v4_status === 'ENCERRADO_PROTEGIDO', 65, 3);
  addWhere('CHURN_CONFIRMADO_CONTROLE', (r) => r.v4_status === 'CHURN_CONFIRMADO', 65, 3);
  addWhere('ATIVADO_SEM_NF_VINCULADA', (r) => Number(r.activated_fichas) > 0 && Number(r.valid_linked_nf_count) === 0, 85, 5);
  addWhere('FICHA_NUNCA_ATIVADA', (r) => Number(r.activated_fichas) === 0, 60, 3);
  addWhere('SAZONAL_12_A_13_MESES', (r) => {
    const d = daysBetween(r.relationship_end_date, asOfDate);
    return r.v4_status === 'ENCERRADO_PROTEGIDO' && d != null && d >= 365 && d <= 405;
  }, 88, 5);

  return out.slice(0, 80);
}

export default async function (req: Request): Promise<Response> {
  const started = Date.now();
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Reconciliação de churn é restrita a administradores.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));

    let source: any = null;
    if (body?.source_id) {
      source = await base44.asServiceRole.entities.ErpDataSource.get(body.source_id);
    } else {
      const sources = await base44.asServiceRole.entities.ErpDataSource.list();
      const active = (sources || []).filter((s: any) => s?.is_active !== false);
      source = active.find((s: any) => String(s?.status || '').toLowerCase() === 'connected')
        || active.find((s: any) => String(s?.name || '').toLowerCase() === 'matriz')
        || active.find((s: any) => s?.credential_reference === 'env')
        || active[0]
        || null;
    }
    if (!source) return Response.json({ error: 'Fonte ERP não encontrada.' }, { status: 404 });

    let asOfDate = String(body?.as_of_date || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(asOfDate)) {
      const snaps = await base44.asServiceRole.entities.ErpSnapshot.filter({ source_id: source.id, is_current: true });
      asOfDate = String(snaps?.[0]?.max_date || '').slice(0, 10);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(asOfDate)) {
      return Response.json({ error: 'as_of_date é obrigatório quando não existe snapshot vigente.' }, { status: 400 });
    }

    const ctx = normalizeRentalChurnV4Context({
      asOfDate,
      inactivityMonths: Number(body?.inactivity_months) || 13,
      periodStart: body?.period_start,
      periodEnd: body?.period_end,
    });
    const dates = rentalChurnV4Dates(ctx);

    const customerSql = buildRentalChurnV4CustomerSql(ctx);
    const customerRows = rowsOf(await execRead(source, customerSql, 120000));

    // Motor temporal separado: transforma fichas efetivamente ativadas em intervalos,
    // une contratos sobrepostos e cria um evento de churn apenas quando o gap até o
    // próximo episódio supera N meses. Assim um churn histórico seguido de reativação
    // não desaparece do período só porque o cliente alugou novamente depois.
    const episodeSql = buildRentalChurnV4EpisodeSql(ctx);
    const episodeRows = rowsOf(await execRead(source, episodeSql, 120000));

    const normalized = customerRows.map((r: any) => ({
      ...r,
      cd_pessoa: String(r.cd_pessoa || ''),
      first_activation_date: iso(r.first_activation_date),
      last_ficha_closed: iso(r.last_ficha_closed),
      last_return_entry: iso(r.last_return_entry),
      last_billing_coverage_end: iso(r.last_billing_coverage_end),
      last_valid_linked_nf: iso(r.last_valid_linked_nf),
      last_canonical_nf: iso(r.last_canonical_nf),
      min_relationship_end_signal: iso(r.min_relationship_end_signal),
      relationship_end_date: iso(r.relationship_end_date),
      churn_date: iso(r.churn_date),
      v4_family: statusFamilyV4(String(r.v4_status || '')),
      v3_family: statusFamilyV3(String(r.v3_status || '')),
      divergence_explanation: DIVERGENCE_EXPLANATIONS[String(r.divergence_type || '')] || null,
    }));

    const activated = normalized.filter((r: any) => Number(r.activated_fichas) > 0);
    const v3Population = normalized.filter((r: any) => Number(r.v3_population_member) === 1);
    const v4Active = normalized.filter((r: any) => ['ATIVO_CONTRATO', 'ATIVO_CONTRATO_COM_ALERTA'].includes(r.v4_status));
    const v4Churn = normalized.filter((r: any) => r.v4_status === 'CHURN_CONFIRMADO');
    const v4Protected = normalized.filter((r: any) => r.v4_status === 'ENCERRADO_PROTEGIDO');
    const v4Audit = normalized.filter((r: any) => String(r.v4_status || '').startsWith('AUDITAR_') || r.v4_status === 'ATIVO_CONTRATO_COM_ALERTA');
    const populationOmitted = normalized.filter((r: any) => r.divergence_type === 'POPULACAO_V3_OMITE_CLIENTE_ATIVADO');
    const ruleDivergences = normalized.filter((r: any) => r.divergence_type !== 'SEM_DIVERGENCIA_REGRA' && r.divergence_type !== 'POPULACAO_V3_OMITE_CLIENTE_ATIVADO');
    const falseChurnContract = normalized.filter((r: any) => r.divergence_type === 'FALSO_CHURN_V3_CONTRATO_ATIVO');
    const falseChurnAnchor = normalized.filter((r: any) => r.divergence_type === 'FALSO_CHURN_V3_ANCORA_TEMPORAL');
    const staleOpenV3Audit = normalized.filter((r: any) => r.divergence_type === 'FICHA_ABERTA_STALE_V3_EXIGE_AUDITORIA');
    const fiscalDivergence = normalized.filter((r: any) => Number(r.fiscal_universe_divergence) === 1);
    const anchorDivergence = normalized.filter((r: any) => Number(r.anchor_divergence_flag) === 1);

    const comparable = normalized.filter((r: any) =>
      Number(r.v3_population_member) === 1
      && !['AUDITAR_SEM_NF'].includes(r.v3_status)
      && !String(r.v4_status || '').startsWith('AUDITAR_')
      && r.v4_status !== 'NAO_CLIENTE_LOCACAO',
    );
    const comparableAgree = comparable.filter((r: any) => Number(r.v3_is_churned) === Number(r.v4_is_churned));

    const priority = (r: any) => {
      const map: Record<string, number> = {
        FALSO_CHURN_V3_CONTRATO_ATIVO: 100,
        FICHA_ABERTA_STALE_V3_EXIGE_AUDITORIA: 95,
        FALSO_CHURN_V3_ANCORA_TEMPORAL: 90,
        AUDITORIA_OPERACIONAL_V4: 85,
        V4_ATIVO_COM_INCONSISTENCIA: 80,
        UNIVERSO_FISCAL_V3_EXCLUI_NF_VINCULADA: 75,
        POPULACAO_V3_OMITE_CLIENTE_ATIVADO: 60,
        SEM_DIVERGENCIA_REGRA: 0,
      };
      return (map[r.divergence_type] || 10) + (Number(r.anchor_spread_days) || 0) / 1000;
    };

    const maxDivergences = Math.max(10, Math.min(Number(body?.max_divergences) || 200, 500));
    const divergenceRows = normalized
      .filter((r: any) => r.divergence_type !== 'SEM_DIVERGENCIA_REGRA')
      .sort((a: any, b: any) => priority(b) - priority(a))
      .slice(0, maxDivergences);

    // Amostra dirigida: cobre divergências e também controles positivos/negativos.
    // O objetivo não é inferir o status do SISLOC, e sim preparar os casos que precisam
    // ser confrontados manualmente com a tela/relatório operacional para fechar ground truth.
    const auditCandidates = buildDirectedAuditCandidates(normalized, ctx.asOfDate);

    // Nome é enriquecimento apenas; a lógica de classificação permanece integralmente no ERP.
    const names: Record<string, string> = {};
    const nameCodes = [...new Set([
      ...divergenceRows.map((r: any) => r.cd_pessoa),
      ...auditCandidates.map((c: any) => c.row.cd_pessoa),
    ].filter((v: string) => /^\d+$/.test(v)))];
    for (let i = 0; i < nameCodes.length; i += 400) {
      const batch = nameCodes.slice(i, i + 400);
      if (!batch.length) continue;
      try {
        const res = await execRead(source,
          `SELECT cd_pessoa, COALESCE(NULLIF(nm_fan_pessoa,''), nm_pessoa) AS nm_pessoa FROM pessoa WITH (NOLOCK) WHERE cd_pessoa IN (${batch.join(',')})`,
          30000,
        );
        for (const r of rowsOf(res)) names[String(r.cd_pessoa)] = String(r.nm_pessoa || '');
      } catch { /* opcional */ }
    }
    for (const r of divergenceRows) r.nm_pessoa = names[r.cd_pessoa] || null;
    for (const c of auditCandidates) c.row.nm_pessoa = names[c.row.cd_pessoa] || null;

    // Evidência ficha a ficha para divergências e para a amostra dirigida. Mantemos limite
    // explícito para não transportar a base inteira ao navegador nem sobrecarregar o wrapper.
    const includeDetails = body?.include_details !== false;
    const detailLimit = Math.max(1, Math.min(Number(body?.detail_limit) || 80, 120));
    const detailCodes = [...new Set([
      ...divergenceRows.slice(0, detailLimit).map((r: any) => r.cd_pessoa),
      ...auditCandidates.map((c: any) => c.row.cd_pessoa),
    ])].slice(0, detailLimit);
    let fichaDetails: any[] = [];
    let detailSql: string | null = null;
    if (includeDetails && detailCodes.length) {
      const detailCtx = normalizeRentalChurnV4Context({ ...ctx, customerIds: detailCodes });
      detailSql = buildRentalChurnV4FichaDetailSql(detailCtx);
      fichaDetails = rowsOf(await execRead(source, detailSql, 120000)).map((r: any) => ({
        ...r,
        cd_pessoa: String(r.cd_pessoa || ''),
        cd_controle: String(r.cd_controle || ''),
        dt_pedido: iso(r.dt_pedido),
        dt_fai_ficha: iso(r.dt_fai_ficha),
        dt_faf_ficha: iso(r.dt_faf_ficha),
        dt_enc_ficha: iso(r.dt_enc_ficha),
        dt_prevista_devolucao: iso(r.dt_prevista_devolucao),
        dt_fat_ficha: iso(r.dt_fat_ficha),
        dt_fau_ficha: iso(r.dt_fau_ficha),
        dt_suspensao: iso(r.dt_suspensao),
        first_remessa: iso(r.first_remessa),
        last_remessa: iso(r.last_remessa),
        last_dt_devolucao: iso(r.last_dt_devolucao),
        last_dt_entrada: iso(r.last_dt_entrada),
        first_fatura_geracao: iso(r.first_fatura_geracao),
        last_fatura_geracao: iso(r.last_fatura_geracao),
        first_fatura_inicio: iso(r.first_fatura_inicio),
        last_fatura_fim: iso(r.last_fatura_fim),
        first_valid_nf: iso(r.first_valid_nf),
        last_valid_nf: iso(r.last_valid_nf),
        last_canonical_nf: iso(r.last_canonical_nf),
      }));
    }

    const episodeCustomers = new Map();
    for (const r of episodeRows) {
      const key = String(r.cd_pessoa || '');
      if (!key) continue;
      if (!episodeCustomers.has(key)) {
        episodeCustomers.set(key, {
          cd_pessoa: key,
          eligible_at_period_start: Number(r.eligible_at_period_start) === 1,
          churn_events_in_period: Number(r.churn_events_in_period) || 0,
          current_inconsistent_fichas: Number(r.current_inconsistent_fichas) || 0,
          first_activation_date: iso(r.first_activation_date),
          latest_activation_before_period: iso(r.latest_activation_before_period),
          latest_churn_before_period: iso(r.latest_churn_before_period),
          last_churn_event_in_period: iso(r.last_churn_event_in_period),
        });
      }
    }
    const episodeCustomerRows = [...episodeCustomers.values()];
    const periodEligibleRaw = episodeCustomerRows.filter((r: any) => r.eligible_at_period_start);
    const periodEligible = periodEligibleRaw.filter((r: any) => r.current_inconsistent_fichas === 0);
    const periodChurnCustomers = periodEligible.filter((r: any) => r.churn_events_in_period > 0);
    const periodChurnEvents = periodChurnCustomers.reduce((s: number, r: any) => s + r.churn_events_in_period, 0);
    const periodChurnRate = periodEligible.length ? (periodChurnCustomers.length / periodEligible.length * 100) : 0;
    const historicalChurnEvents = episodeRows.filter((r: any) => Number(r.is_churn_event) === 1);
    const reactivatedAfterChurn = historicalChurnEvents.filter((r: any) => r.next_episode_start != null);
    const churnEventsInPeriodRows = episodeRows.filter((r: any) =>
      Number(r.is_churn_event) === 1
      && r.candidate_churn_date
      && iso(r.candidate_churn_date) >= ctx.periodStart
      && iso(r.candidate_churn_date) < ctx.periodEnd,
    ).map((r: any) => ({
      cd_pessoa: String(r.cd_pessoa || ''),
      episode_id: Number(r.episode_id) || 0,
      episode_start: iso(r.episode_start),
      episode_end: iso(r.episode_end),
      churn_date: iso(r.candidate_churn_date),
      next_episode_start: iso(r.next_episode_start),
      reactivated_after_churn: !!r.next_episode_start,
      eligible_at_period_start: Number(r.eligible_at_period_start) === 1,
      current_inconsistent_fichas: Number(r.current_inconsistent_fichas) || 0,
    }));

    const summary = {
      all_people_with_ficha: normalized.length,
      historically_activated_customers: activated.length,
      v3_population_customers: v3Population.length,
      v3_population_coverage_pct: activated.length ? Number((v3Population.length / activated.length * 100).toFixed(2)) : 0,
      v3_population_omitted_activated: populationOmitted.length,
      v4_active_contract_customers: v4Active.length,
      v4_protected_closed_customers: v4Protected.length,
      v4_churn_snapshot_customers: v4Churn.length,
      v4_operational_audit_customers: v4Audit.length,
      comparable_customers: comparable.length,
      churn_class_agreement_customers: comparableAgree.length,
      churn_class_agreement_pct: comparable.length ? Number((comparableAgree.length / comparable.length * 100).toFixed(2)) : 0,
      known_rule_divergences: ruleDivergences.length,
      false_churn_v3_open_contract: falseChurnContract.length,
      false_churn_v3_temporal_anchor: falseChurnAnchor.length,
      stale_open_ficha_v3_requires_audit: staleOpenV3Audit.length,
      fiscal_universe_divergence_customers: fiscalDivergence.length,
      fiscal_linked_valid_documents: normalized.reduce((s: number, r: any) => s + (Number(r.valid_linked_nf_count) || 0), 0),
      fiscal_canonical_documents: normalized.reduce((s: number, r: any) => s + (Number(r.canonical_nf_count) || 0), 0),
      anchor_spread_over_45d_customers: anchorDivergence.length,
      unexplained_divergences_vs_sisloc_ground_truth: null,
    };

    return Response.json({
      success: true,
      engine: {
        version: RENTAL_CHURN_V4_VERSION,
        status: RENTAL_CHURN_V4_STATUS,
        trusted: false,
        reconciliation_stage: 'V3_V4_RULE_RECONCILIATION',
        sisloc_ground_truth_status: 'PENDING_DIRECTED_SAMPLE_VALIDATION',
      },
      source: { id: source.id, name: source.name, status: source.status },
      context: {
        as_of_date: ctx.asOfDate,
        inactivity_months: ctx.inactivityMonths,
        churn_cutoff: dates.cutoff,
        v3_ref_start: dates.refStart,
        v3_analysis_start: dates.analysisStart,
        v3_analysis_end: dates.analysisEnd,
        period_start: ctx.periodStart,
        period_end_exclusive: ctx.periodEnd,
      },
      summary,
      period_churn: {
        status: 'CANDIDATE_EPISODE_ENGINE_NOT_TRUSTED',
        trusted: false,
        period_start: ctx.periodStart,
        period_end_exclusive: ctx.periodEnd,
        eligible_customers_at_period_start_raw: periodEligibleRaw.length,
        excluded_current_operational_audit: periodEligibleRaw.length - periodEligible.length,
        eligible_customers_at_period_start: periodEligible.length,
        new_churn_customers: periodChurnCustomers.length,
        new_churn_events: periodChurnEvents,
        period_churn_rate: Number(periodChurnRate.toFixed(4)),
        historical_churn_events_detected: historicalChurnEvents.length,
        historical_churns_with_later_reactivation: reactivatedAfterChurn.length,
        methodology: 'Fichas ativadas -> intervalos -> união de contratos sobrepostos -> episódio -> churn_date = episode_end + N meses, somente se não houver novo episódio até essa data.',
        caveat: 'Ainda NÃO TRUSTED: precisa ser reconciliado em amostra dirigida, principalmente devoluções parciais, fichas abertas stale e diferenças entre fim operacional e cobertura faturada.',
      },
      period_churn_events: churnEventsInPeriodRows.slice(0, 500),
      divergence_breakdown: Object.entries(normalized.reduce((acc: Record<string, number>, r: any) => {
        const key = String(r.divergence_type || 'NAO_CLASSIFICADO');
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {})).map(([type, count]) => ({
        type,
        count,
        explanation: DIVERGENCE_EXPLANATIONS[type] || null,
      })).sort((a: any, b: any) => b.count - a.count),
      top_divergences: divergenceRows,
      ficha_evidence: fichaDetails,
      queries: body?.include_queries === true ? { customer: customerSql, episodes: episodeSql, detail: detailSql } : undefined,
      duration_ms: Date.now() - started,
    });
  } catch (error) {
    return Response.json({ success: false, error: error?.message || String(error) }, { status: 500 });
  }
}
