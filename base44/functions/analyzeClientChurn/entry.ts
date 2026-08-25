import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { buildConfig, runQuery } from '../../shared/erpConnection.ts';
import { approvedRemessaFrom, faturaFrom } from '../../shared/churnUniverse.ts';
import { empFilter } from '../../shared/empresaScope.ts';
import { invoiceUniverse } from '../../shared/invoiceUniverse.ts';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

function minusMonthsIso(iso: string, months: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}

function minusDaysIso(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function getRows(result) {
  if (!result) return [];
  if (Array.isArray(result.recordset) && result.recordset.length > 0) return result.recordset;
  if (Array.isArray(result.recordsets)) {
    for (let i = result.recordsets.length - 1; i >= 0; i--) {
      if (Array.isArray(result.recordsets[i]) && result.recordsets[i].length > 0) return result.recordsets[i];
    }
  }
  if (Array.isArray(result)) return result;
  return [];
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const sourceId = body?.source_id;

    let source;
    if (sourceId && sourceId !== '__all__') {
      source = await base44.asServiceRole.entities.ErpDataSource.get(sourceId);
    } else {
      const sources = await base44.asServiceRole.entities.ErpDataSource.list();
      const active = (sources || []).filter((s) => s?.is_active !== false);
      source = active.find((s) => String(s?.status || '').toLowerCase() === 'connected')
        || active.find((s) => String(s?.name || '').toLowerCase() === 'matriz')
        || active.find((s) => s?.credential_reference === 'env')
        || active[0]
        || null;
    }
    if (!source) return Response.json({ success: false, error: 'Nenhuma fonte ERP ativa e utilizável foi encontrada.' });

    const refStart = body?.ref_start;
    const refEnd = body?.ref_end;
    const analysisStart = body?.analysis_start;
    const analysisEnd = body?.analysis_end;
    // Janela de inatividade (padrão 13 meses): clientes com sazonalidade anual
    // (ex.: manutenção de usinas 1x/ano) só viram churn após esse prazo.
    const inactivityMonths = Number(body?.inactivity_months) > 0 ? Number(body.inactivity_months) : 13;

    if (!dateRegex.test(refStart || '') || !dateRegex.test(refEnd || '') ||
        !dateRegex.test(analysisStart || '') || !dateRegex.test(analysisEnd || '')) {
      return Response.json({ success: false, error: 'Datas devem estar no formato YYYY-MM-DD.' });
    }

    const config = buildConfig(source);
    if (!config) throw new Error('Configuração de conexão incompleta.');

    const wrap = (inner) => config.clientId
      ? `EXEC DW_API '${config.clientId}', '${inner.replace(/'/g, "''")}'`
      : inner;

    // Churn de locação v3, homologado contra o fluxo real da ficha no SISLOC:
    // 1) ficha efetivamente aberta prevalece sobre recência;
    // 2) se todas as fichas efetivas estão encerradas, o relógio oficial é a última NF válida
    //    vinculada à locação (fl_fatura -> nf);
    // 3) remessa/devolução/movimento são evidências operacionais, mas não renovam o relógio
    //    de churn de um cliente sem contrato vigente;
    // 4) ausência de NF em uma locação efetiva vira exceção para auditoria, não churn automático.
    const inactivityCutoff = minusMonthsIso(analysisEnd, inactivityMonths);
    const asOfDate = minusDaysIso(analysisEnd, 1);
    const churnSql = `WITH rental_nf_events AS (
      SELECT f.cd_pessoa, f.cd_controle, n.cd_nf,
             COALESCE(n.dt_emi_nf, v.dt_emissao) AS dt_nf
      FROM fl_fatura fat WITH (NOLOCK)
      INNER JOIN fich_loc f WITH (NOLOCK) ON f.cd_controle = fat.cd_controle
      INNER JOIN nf n WITH (NOLOCK) ON n.cd_nf = fat.cd_nf
      LEFT JOIN v_nf_emissao v WITH (NOLOCK) ON v.cd_nf = n.cd_nf
      WHERE fat.cd_nf IS NOT NULL
        AND COALESCE(n.dt_emi_nf, v.dt_emissao) >= '${refStart}'
        AND COALESCE(n.dt_emi_nf, v.dt_emissao) < '${analysisEnd}'
        AND ${invoiceUniverse('n')}
        ${empFilter('f')}

      UNION

      SELECT f.cd_pessoa, f.cd_controle, n.cd_nf,
             COALESCE(n.dt_emi_nf, v.dt_emissao) AS dt_nf
      FROM fl_fatura fat WITH (NOLOCK)
      INNER JOIN fich_loc f WITH (NOLOCK) ON f.cd_controle = fat.cd_controle
      INNER JOIN nf n WITH (NOLOCK) ON n.cd_nf = fat.cd_nf_mo
      LEFT JOIN v_nf_emissao v WITH (NOLOCK) ON v.cd_nf = n.cd_nf
      WHERE fat.cd_nf_mo IS NOT NULL
        AND COALESCE(n.dt_emi_nf, v.dt_emissao) >= '${refStart}'
        AND COALESCE(n.dt_emi_nf, v.dt_emissao) < '${analysisEnd}'
        AND ${invoiceUniverse('n')}
        ${empFilter('f')}
    ),
    remessa_by_contract AS (
      SELECT f.cd_pessoa, f.cd_controle, MAX(r.dt_saida) AS last_remessa
      ${approvedRemessaFrom}
        AND r.dt_saida < '${analysisEnd}'
      GROUP BY f.cd_pessoa, f.cd_controle
    ),
    nf_by_contract AS (
      SELECT cd_pessoa, cd_controle, MAX(dt_nf) AS last_nf, COUNT(DISTINCT cd_nf) AS nf_count
      FROM rental_nf_events
      GROUP BY cd_pessoa, cd_controle
    ),
    ref_events AS (
      SELECT f.cd_pessoa, f.cd_controle, r.dt_saida AS dt_evento
      ${approvedRemessaFrom}
        AND r.dt_saida >= '${refStart}' AND r.dt_saida < '${refEnd}'

      UNION

      SELECT cd_pessoa, cd_controle, dt_nf
      FROM rental_nf_events
      WHERE dt_nf >= '${refStart}' AND dt_nf < '${refEnd}'
    ),
    ref_clients AS (
      SELECT cd_pessoa,
             COUNT(DISTINCT cd_controle) AS ref_fichas,
             MIN(dt_evento) AS ref_first_ficha,
             MAX(dt_evento) AS ref_last_ficha
      FROM ref_events
      GROUP BY cd_pessoa
    ),
    nf_activity AS (
      SELECT e.cd_pessoa,
             MAX(e.dt_nf) AS last_rental_nf,
             COUNT(DISTINCT e.cd_nf) AS rental_nf_count
      FROM rental_nf_events e
      INNER JOIN ref_clients rc ON rc.cd_pessoa = e.cd_pessoa
      GROUP BY e.cd_pessoa
    ),
    ref_nf_activity AS (
      SELECT e.cd_pessoa,
             COUNT(DISTINCT e.cd_nf) AS ref_nfs,
             MIN(e.dt_nf) AS ref_first_nf,
             MAX(e.dt_nf) AS ref_last_nf
      FROM rental_nf_events e
      INNER JOIN ref_clients rc ON rc.cd_pessoa = e.cd_pessoa
      WHERE e.dt_nf >= '${refStart}' AND e.dt_nf < '${refEnd}'
      GROUP BY e.cd_pessoa
    ),
    analysis_nf_activity AS (
      SELECT e.cd_pessoa,
             COUNT(DISTINCT e.cd_nf) AS analysis_nfs,
             MAX(e.dt_nf) AS analysis_last_nf
      FROM rental_nf_events e
      INNER JOIN ref_clients rc ON rc.cd_pessoa = e.cd_pessoa
      WHERE e.dt_nf >= '${analysisStart}' AND e.dt_nf < '${analysisEnd}'
      GROUP BY e.cd_pessoa
    ),
    contract_profile AS (
      SELECT
        f.cd_pessoa,
        f.cd_controle,
        f.dt_pedido,
        f.dt_fai_ficha,
        f.dt_faf_ficha,
        f.dt_enc_ficha,
        f.dt_prevista_devolucao,
        f.dt_fau_ficha,
        f.dt_fat_ficha,
        f.dt_mov,
        f.nr_periodos,
        cf.ds_calcfat,
        cf.num_dias_periodo,
        rb.last_remessa AS contract_last_remessa,
        nb.last_nf AS contract_last_nf,
        CASE
          WHEN f.dt_enc_ficha IS NULL
           AND (rb.last_remessa IS NOT NULL OR nb.last_nf IS NOT NULL)
          THEN 1 ELSE 0
        END AS ficha_aberta_efetiva,
        MAX(CASE
          WHEN f.dt_enc_ficha IS NULL
           AND (rb.last_remessa IS NOT NULL OR nb.last_nf IS NOT NULL)
          THEN 1 ELSE 0
        END) OVER (PARTITION BY f.cd_pessoa) AS contrato_aberto,
        SUM(CASE
          WHEN f.dt_enc_ficha IS NULL
           AND (rb.last_remessa IS NOT NULL OR nb.last_nf IS NOT NULL)
          THEN 1 ELSE 0
        END) OVER (PARTITION BY f.cd_pessoa) AS fichas_abertas,
        MAX(f.dt_enc_ficha) OVER (PARTITION BY f.cd_pessoa) AS ultima_ficha_encerrada,
        ROW_NUMBER() OVER (
          PARTITION BY f.cd_pessoa
          ORDER BY
            CASE
              WHEN f.dt_enc_ficha IS NULL
               AND (rb.last_remessa IS NOT NULL OR nb.last_nf IS NOT NULL)
              THEN 0 ELSE 1
            END,
            COALESCE(nb.last_nf, rb.last_remessa, f.dt_pedido, f.dt_mov) DESC,
            f.cd_controle DESC
        ) AS rn
      FROM fich_loc f WITH (NOLOCK)
      INNER JOIN ref_clients rc ON rc.cd_pessoa = f.cd_pessoa
      LEFT JOIN calcfat cf WITH (NOLOCK) ON cf.cd_calcfat = f.cd_calcfat
      LEFT JOIN remessa_by_contract rb ON rb.cd_controle = f.cd_controle
      LEFT JOIN nf_by_contract nb ON nb.cd_controle = f.cd_controle
      WHERE f.cd_pessoa IS NOT NULL ${empFilter('f')}
    )
    SELECT
      r.cd_pessoa,
      r.ref_fichas,
      r.ref_first_ficha,
      r.ref_last_ficha,
      ISNULL(cp.contrato_aberto, 0) AS contrato_aberto,
      ISNULL(cp.fichas_abertas, 0) AS fichas_abertas,
      cp.ultima_ficha_encerrada,
      cp.cd_controle AS latest_contract_id,
      cp.dt_pedido AS latest_contract_opened,
      cp.dt_fai_ficha AS latest_contract_start,
      cp.dt_faf_ficha AS latest_contract_end,
      cp.dt_enc_ficha AS latest_contract_closed,
      cp.dt_prevista_devolucao AS latest_expected_return,
      cp.dt_fau_ficha AS last_contract_generation,
      cp.dt_fat_ficha AS next_contract_billing,
      cp.dt_mov AS last_contract_update,
      cp.contract_last_remessa AS last_remessa,
      cp.contract_last_nf AS latest_contract_nf,
      na.last_rental_nf,
      na.rental_nf_count,
      ISNULL(rna.ref_nfs, 0) AS ref_nfs,
      rna.ref_first_nf,
      rna.ref_last_nf,
      ISNULL(ana.analysis_nfs, 0) AS analysis_nfs,
      ana.analysis_last_nf,
      cp.ds_calcfat AS rental_period_description,
      cp.num_dias_periodo AS rental_period_days,
      cp.nr_periodos AS contract_periods,
      CASE
        WHEN cp.num_dias_periodo IS NULL OR cp.num_dias_periodo <= 0 THEN 'NAO_CLASSIFICADO'
        WHEN cp.num_dias_periodo <= 2 THEN 'DIARIA'
        WHEN cp.num_dias_periodo <= 8 THEN 'SEMANAL'
        WHEN cp.num_dias_periodo <= 16 THEN 'QUINZENAL'
        WHEN cp.num_dias_periodo <= 35 THEN 'MENSAL'
        WHEN cp.num_dias_periodo <= 100 THEN 'CICLO_LONGO'
        WHEN cp.num_dias_periodo >= 300 THEN 'ANUAL'
        ELSE 'MULTIMENSAL'
      END AS billing_cycle,
      CASE
        WHEN cp.dt_fai_ficha IS NOT NULL AND COALESCE(cp.dt_prevista_devolucao, cp.dt_faf_ficha, cp.dt_enc_ficha) IS NOT NULL
          THEN DATEDIFF(day, cp.dt_fai_ficha, COALESCE(cp.dt_prevista_devolucao, cp.dt_faf_ficha, cp.dt_enc_ficha))
        WHEN cp.nr_periodos IS NOT NULL AND cp.num_dias_periodo IS NOT NULL
          THEN cp.nr_periodos * cp.num_dias_periodo
        ELSE NULL
      END AS contract_horizon_days,
      CASE
        WHEN ISNULL(cp.contrato_aberto,0) = 1 THEN 'CONTRATO_VIGENTE'
        WHEN na.last_rental_nf IS NULL THEN 'SEM_NF_AUDITAR'
        WHEN na.last_rental_nf >= '${inactivityCutoff}' THEN 'NF_RECENTE'
        ELSE 'SEM_NF_${inactivityMonths}M'
      END AS retention_reason,
      CASE
        WHEN ISNULL(cp.contrato_aberto,0) = 1 THEN 0
        WHEN na.last_rental_nf IS NULL THEN 0
        WHEN na.last_rental_nf >= '${inactivityCutoff}' THEN 0
        ELSE 1
      END AS is_churned,
      CASE
        WHEN ISNULL(cp.contrato_aberto,0) = 1 OR na.last_rental_nf IS NOT NULL THEN 1
        ELSE 0
      END AS eligible_for_churn
    FROM ref_clients r
    LEFT JOIN nf_activity na ON na.cd_pessoa = r.cd_pessoa
    LEFT JOIN ref_nf_activity rna ON rna.cd_pessoa = r.cd_pessoa
    LEFT JOIN analysis_nf_activity ana ON ana.cd_pessoa = r.cd_pessoa
    LEFT JOIN contract_profile cp ON cp.cd_pessoa = r.cd_pessoa AND cp.rn = 1
    ORDER BY COALESCE(na.last_rental_nf, cp.contract_last_remessa, r.ref_last_ficha) DESC`;

    const result = await runQuery(source, wrap(churnSql), 60000);
    const rows = getRows(result);

    // Receita por cliente a partir de fl_fatura (vl_fatura das faturas da ficha) nos
    // períodos de referência e análise — substitui o proxy da tabela nf.
    const allCodes = rows.map(r => r.cd_pessoa).filter(v => v != null && v !== '');
    const buildCodesList = (codes) => codes.map(c => {
      const n = Number(c);
      return isNaN(n) ? `'${String(c).replace(/'/g, "''")}'` : String(n);
    }).join(',');
    const BATCH = 500;
    const revMap = {};
    if (allCodes.length > 0) {
      try {
        for (let i = 0; i < allCodes.length; i += BATCH) {
          const codesList = buildCodesList(allCodes.slice(i, i + BATCH));
          const revSql = `SELECT f.cd_pessoa,
            ISNULL(SUM(CASE WHEN fat.dt_geracao >= '${refStart}' AND fat.dt_geracao < '${refEnd}' THEN fat.vl_fatura ELSE 0 END),0) AS ref_revenue,
            ISNULL(SUM(CASE WHEN fat.dt_geracao >= '${analysisStart}' AND fat.dt_geracao < '${analysisEnd}' THEN fat.vl_fatura ELSE 0 END),0) AS analysis_revenue
            ${faturaFrom}
              AND fat.dt_geracao >= '${refStart}' AND fat.dt_geracao < '${analysisEnd}'
              AND f.cd_pessoa IN (${codesList})
            GROUP BY f.cd_pessoa`;
          for (const r of getRows(await runQuery(source, wrap(revSql), 20000))) {
            revMap[String(r.cd_pessoa)] = r;
          }
        }
      } catch {}
    }
    for (const r of rows) {
      const rv = revMap[String(r.cd_pessoa)] || {};
      r.ref_revenue = Number(rv.ref_revenue) || 0;
      r.analysis_revenue = Number(rv.analysis_revenue) || 0;
    }

    // Estados de Growth sobre a regra dura de churn. O limite final continua sendo
    // inactivityMonths (13m por padrão), mas antes dele criamos faixas acionáveis.
    const asOfMs = new Date(`${asOfDate}T00:00:00Z`).getTime();
    const cutoffMs = new Date(`${inactivityCutoff}T00:00:00Z`).getTime();
    const thresholdDays = Math.max(1, Math.round((asOfMs - cutoffMs) / 86400000));
    const watchDays = Math.round(thresholdDays * 0.50);
    const preChurnDays = Math.round(thresholdDays * 0.75);

    const horizonBucket = (days) => {
      const d = Number(days);
      if (!Number.isFinite(d) || d < 0) return 'NAO_CLASSIFICADO';
      if (d <= 2) return 'ATE_2_DIAS';
      if (d <= 8) return '3_A_8_DIAS';
      if (d <= 16) return '9_A_16_DIAS';
      if (d <= 45) return '17_A_45_DIAS';
      if (d <= 180) return '46_A_180_DIAS';
      if (d <= 300) return '181_A_300_DIAS';
      return '301_DIAS_OU_MAIS';
    };

    for (const r of rows) {
      const last = r.last_rental_nf ? new Date(r.last_rental_nf).getTime() : null;
      const daysSince = last && Number.isFinite(last) ? Math.max(0, Math.floor((asOfMs - last) / 86400000)) : null;
      r.days_since_last_activity = daysSince;
      r.contract_horizon = horizonBucket(r.contract_horizon_days);

      if (Number(r.contrato_aberto) === 1) {
        const cycleDays = Number(r.rental_period_days) || 0;
        const toleranceDays = cycleDays > 0 ? Math.max(45, Math.round(cycleDays * 2)) : 90;
        const contractLastNfMs = r.latest_contract_nf ? new Date(r.latest_contract_nf).getTime() : null;
        const contractLastRemessaMs = r.last_remessa ? new Date(r.last_remessa).getTime() : null;
        const contractNfAge = contractLastNfMs && Number.isFinite(contractLastNfMs)
          ? Math.max(0, Math.floor((asOfMs - contractLastNfMs) / 86400000))
          : null;
        const remessaAge = contractLastRemessaMs && Number.isFinite(contractLastRemessaMs)
          ? Math.max(0, Math.floor((asOfMs - contractLastRemessaMs) / 86400000))
          : null;
        r.contract_billing_alert = contractNfAge != null
          ? contractNfAge > toleranceDays
          : (remessaAge != null && remessaAge > toleranceDays);
        r.growth_status = r.contract_billing_alert ? 'ATIVO_CONTRATO_ALERTA' : 'ATIVO_CONTRATO';
      } else if (Number(r.eligible_for_churn) !== 1) r.growth_status = 'AUDITAR_SEM_NF';
      else if (Number(r.is_churned) === 1) r.growth_status = 'CHURN_CONFIRMADO';
      else if (daysSince != null && daysSince >= preChurnDays) r.growth_status = 'PRE_CHURN';
      else if (daysSince != null && daysSince >= watchDays) r.growth_status = 'MONITORAR';
      else r.growth_status = 'ATIVO_RECENTE';
    }

    const totalRef = rows.length;
    const eligibleRows = rows.filter(r => Number(r.eligible_for_churn) === 1);
    const auditRows = rows.filter(r => Number(r.eligible_for_churn) !== 1);
    const churnedRows = eligibleRows.filter(r => Number(r.is_churned) === 1);
    const activeRows = eligibleRows.filter(r => Number(r.is_churned) === 0);
    const revenueAtRisk = churnedRows.reduce((s, r) => s + (Number(r.ref_revenue) || 0), 0);
    const activeRevenue = activeRows.reduce((s, r) => s + (Number(r.ref_revenue) || 0), 0);
    const churnRate = eligibleRows.length > 0 ? (churnedRows.length / eligibleRows.length * 100) : 0;
    const retainedByContract = activeRows.filter(r => r.retention_reason === 'CONTRATO_VIGENTE');
    const retainedByActivity = activeRows.filter(r => r.retention_reason === 'NF_RECENTE');
    const preventedFalseChurn = activeRows.filter(r => Number(r.contrato_aberto) === 1 && (
      !r.last_rental_nf || Number(r.days_since_last_activity) >= thresholdDays
    ));
    const seasonalProtected = activeRows.filter(r => Number(r.contrato_aberto) === 0 && Number(r.days_since_last_activity) >= 365);
    const longContractsActive = activeRows.filter(r => Number(r.contrato_aberto) === 1 && r.contract_horizon === '301_DIAS_OU_MAIS');
    const monthlyOpenContracts = activeRows.filter(r => Number(r.contrato_aberto) === 1 && r.billing_cycle === 'MENSAL');
    const openContractAlerts = activeRows.filter(r => Number(r.contrato_aberto) === 1 && r.contract_billing_alert);
    const monitorRows = rows.filter(r => r.growth_status === 'MONITORAR');
    const preChurnRows = rows.filter(r => r.growth_status === 'PRE_CHURN');
    const actionRows = rows.filter(r => [
      'MONITORAR',
      'PRE_CHURN',
      'CHURN_CONFIRMADO',
      'ATIVO_CONTRATO_ALERTA',
      'AUDITAR_SEM_NF',
    ].includes(String(r.growth_status || '')));

    const summarize = (field) => {
      const map = {};
      for (const r of rows) {
        const key = String(r[field] || 'NAO_CLASSIFICADO');
        if (!map[key]) map[key] = { label: key, clients: 0, active: 0, churned: 0, audit: 0, revenue_ref: 0 };
        map[key].clients += 1;
        map[key].active += Number(r.eligible_for_churn) === 1 && Number(r.is_churned) === 0 ? 1 : 0;
        map[key].churned += Number(r.eligible_for_churn) === 1 && Number(r.is_churned) === 1 ? 1 : 0;
        map[key].audit += Number(r.eligible_for_churn) !== 1 ? 1 : 0;
        map[key].revenue_ref += Number(r.ref_revenue) || 0;
      }
      return Object.values(map).sort((a, b) => b.clients - a.clients);
    };
    const growthSegments = summarize('growth_status');
    const billingSegments = summarize('billing_cycle');
    const horizonSegments = summarize('contract_horizon');

    // Monthly churn: mês da última NF válida de locação antes da perda.
    const monthlyChurn = {};
    for (const r of churnedRows) {
      if (r.last_rental_nf) {
        const d = new Date(r.last_rental_nf);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthlyChurn[key] = (monthlyChurn[key] || 0) + 1;
      }
    }
    const monthlyChurnArray = Object.entries(monthlyChurn)
      .map(([k, v]) => {
        const [y, m] = k.split('-');
        return { ano: Number(y), mes: Number(m), churned: v };
      })
      .sort((a, b) => a.ano === b.ano ? a.mes - b.mes : a.ano - b.ano);

    // ---- Detailed enrichment for actionable Growth clients ----
    // Reativação e Customer Health usam a mesma população classificada pelo churn v3.
    const detailClients = actionRows;
    const pessoaCodes = detailClients.map(r => r.cd_pessoa).filter(v => v != null && v !== '');

    const pessoaMap = {};
    const fichlocMap = {};
    const movitemMap = {};

    if (pessoaCodes.length > 0) {
      // 1. Client master data (pessoa): name, CPF/CNPJ, phone, email, region — batched
      try {
        for (let i = 0; i < pessoaCodes.length; i += BATCH) {
          const codesList = buildCodesList(pessoaCodes.slice(i, i + BATCH));
          const pessoaSql = `SELECT cd_pessoa, nm_pessoa, fl_tipo_pessoa, nr_cpf_pessoa, nr_cnpj_pessoa,
            en_mail_pessoa, tel_pessoa, tl_res_pessoa, tl_cel_pessoa, uf_pessoa, cidade_pessoa
            FROM pessoa WITH (NOLOCK) WHERE cd_pessoa IN (${codesList})`;
          for (const p of getRows(await runQuery(source, wrap(pessoaSql), 20000))) {
            pessoaMap[String(p.cd_pessoa)] = p;
          }
        }
      } catch {}

      // 2. Rental contracts (fich_loc): contract period, renewals, closing value — batched
      try {
        for (let i = 0; i < pessoaCodes.length; i += BATCH) {
          const codesList = buildCodesList(pessoaCodes.slice(i, i + BATCH));
          const fichSql = `SELECT cd_pessoa,
            MIN(dt_pedido) AS prim_dt_pedido,
            MAX(dt_pedido) AS ult_dt_pedido,
            MAX(dt_enc_ficha) AS ult_dt_enc_ficha,
            COUNT(*) AS total_contratos,
            SUM(CASE WHEN fl_rep_ficha = 'S' THEN 1 ELSE 0 END) AS qtd_renovacoes,
            ISNULL(SUM(vl_encerramento),0) AS total_encerramento
            FROM fich_loc WITH (NOLOCK)
            WHERE cd_pessoa IN (${codesList})
              ${empFilter()}
            GROUP BY cd_pessoa`; 
          for (const f of getRows(await runQuery(source, wrap(fichSql), 20000))) {
            fichlocMap[String(f.cd_pessoa)] = f;
          }
        }
      } catch {}

      // 3. Rented products (nfmerc): split JOIN into two simple queries to avoid timeout.
      //    Step A: cd_nf → cd_pessoa mapping for ALL churned clients in ref period — batched
      //    Step B: nfmerc by cd_nf IN (...) — uses index on cd_nf (key field).
      try {
        const nfToPessoa = {};
        for (let i = 0; i < pessoaCodes.length; i += BATCH) {
          const codesList = buildCodesList(pessoaCodes.slice(i, i + BATCH));
          const nfMapSql = `SELECT DISTINCT n.cd_nf, f.cd_pessoa
            FROM fl_fatura fat WITH (NOLOCK)
            INNER JOIN fich_loc f WITH (NOLOCK) ON f.cd_controle = fat.cd_controle
            INNER JOIN nf n WITH (NOLOCK) ON n.cd_nf = fat.cd_nf
            WHERE f.cd_pessoa IN (${codesList})
              AND n.dt_emi_nf >= '${refStart}' AND n.dt_emi_nf < '${refEnd}'
              AND ${invoiceUniverse('n')}
              ${empFilter('f')}
            UNION
            SELECT DISTINCT n.cd_nf, f.cd_pessoa
            FROM fl_fatura fat WITH (NOLOCK)
            INNER JOIN fich_loc f WITH (NOLOCK) ON f.cd_controle = fat.cd_controle
            INNER JOIN nf n WITH (NOLOCK) ON n.cd_nf = fat.cd_nf_mo
            WHERE f.cd_pessoa IN (${codesList})
              AND n.dt_emi_nf >= '${refStart}' AND n.dt_emi_nf < '${refEnd}'
              AND ${invoiceUniverse('n')}
              ${empFilter('f')}`;
          for (const r of getRows(await runQuery(source, wrap(nfMapSql), 20000))) {
            nfToPessoa[String(r.cd_nf)] = String(r.cd_pessoa);
          }
        }
        const nfCodes = Object.keys(nfToPessoa);
        if (nfCodes.length > 0) {
          const agg = {};
          for (let i = 0; i < nfCodes.length; i += BATCH) {
            const nfList = nfCodes.slice(i, i + BATCH).map(c => {
              const n = Number(c);
              return isNaN(n) ? `'${c.replace(/'/g, "''")}'` : String(n);
            }).join(',');
            const prodSql = `SELECT cd_nf,
              CAST(ds_mer_nfmerc AS nvarchar(500)) AS ds_mer_nfmerc,
              cd_equipto,
              SUM(qt_nfmerc) AS qt,
              SUM(qt_nfmerc * vl_uni_nfmerc) AS valor
              FROM nfmerc WITH (NOLOCK)
              WHERE cd_nf IN (${nfList})
                AND CAST(ds_mer_nfmerc AS nvarchar(500)) <> ''
              GROUP BY cd_nf, CAST(ds_mer_nfmerc AS nvarchar(500)), cd_equipto`;
            for (const r of getRows(await runQuery(source, wrap(prodSql), 20000))) {
              const key = nfToPessoa[String(r.cd_nf)];
              if (!key) continue;
              if (!agg[key]) agg[key] = { produtos: [], codigos: [], total_qt: 0, total_valor: 0 };
              agg[key].produtos.push(r.ds_mer_nfmerc);
              if (r.cd_equipto != null) agg[key].codigos.push(String(r.cd_equipto));
              agg[key].total_qt += Number(r.qt) || 0;
              agg[key].total_valor += Number(r.valor) || 0;
            }
          }
          for (const [k, v] of Object.entries(agg)) {
            movitemMap[k] = {
              produtos_locados: [...new Set(v.produtos)].join(', '),
              codigos_equipto: [...new Set(v.codigos)].join(', '),
              total_qt: v.total_qt,
              total_valor: v.total_valor,
            };
          }
        }
      } catch {}
    }

    return Response.json({
      success: true,
      summary: {
        total_ref_clients: totalRef,
        eligible_clients: eligibleRows.length,
        audit_without_nf: auditRows.length,
        active_clients: activeRows.length,
        churned_clients: churnedRows.length,
        churn_rate: churnRate,
        inactivity_months: inactivityMonths,
        inactivity_cutoff: inactivityCutoff,
        as_of_date: asOfDate,
        retained_by_contract: retainedByContract.length,
        retained_by_activity: retainedByActivity.length,
        open_contract_clients: activeRows.filter(r => Number(r.contrato_aberto) === 1).length,
        prevented_false_churn: preventedFalseChurn.length,
        seasonal_protected_clients: seasonalProtected.length,
        long_contract_active_clients: longContractsActive.length,
        monthly_open_contract_clients: monthlyOpenContracts.length,
        open_contract_billing_alerts: openContractAlerts.length,
        revenue_at_risk: revenueAtRisk,
        active_revenue: activeRevenue,
        avg_churned_revenue: churnedRows.length > 0 ? revenueAtRisk / churnedRows.length : 0,
      },
      segments: {
        growth_status: growthSegments,
        billing_cycle: billingSegments,
        contract_horizon: horizonSegments,
      },
      churned_clients: detailClients.map(r => {
        const p = pessoaMap[String(r.cd_pessoa)] || {};
        const f = fichlocMap[String(r.cd_pessoa)] || {};
        const m = movitemMap[String(r.cd_pessoa)] || {};
        return {
          cd_pessoa: String(r.cd_pessoa || ''),
          nm_pessoa: p.nm_pessoa || null,
          fl_tipo_pessoa: p.fl_tipo_pessoa || null,
          nr_cpf_pessoa: p.nr_cpf_pessoa || null,
          nr_cnpj_pessoa: p.nr_cnpj_pessoa || null,
          en_mail_pessoa: p.en_mail_pessoa || null,
          telefone: p.tl_cel_pessoa || p.tl_res_pessoa || p.tel_pessoa || null,
          uf_pessoa: p.uf_pessoa || null,
          cidade_pessoa: p.cidade_pessoa || null,
          ref_revenue: Number(r.ref_revenue) || 0,
          ref_nfs: Number(r.ref_nfs) || 0,
          ref_first_nf: r.ref_first_nf ? new Date(r.ref_first_nf).toISOString().slice(0, 10) : null,
          ref_last_nf: r.ref_last_nf ? new Date(r.ref_last_nf).toISOString().slice(0, 10) : null,
          ref_fichas: Number(r.ref_fichas) || 0,
          ref_first_ficha: r.ref_first_ficha ? new Date(r.ref_first_ficha).toISOString().slice(0, 10) : null,
          ref_last_ficha: r.ref_last_ficha ? new Date(r.ref_last_ficha).toISOString().slice(0, 10) : null,
          last_activity: r.last_rental_nf ? new Date(r.last_rental_nf).toISOString().slice(0, 10) : null,
          last_rental_nf: r.last_rental_nf ? new Date(r.last_rental_nf).toISOString().slice(0, 10) : null,
          days_since_last_activity: r.days_since_last_activity == null ? null : Number(r.days_since_last_activity),
          last_remessa: r.last_remessa ? new Date(r.last_remessa).toISOString().slice(0, 10) : null,
          latest_contract_nf: r.latest_contract_nf ? new Date(r.latest_contract_nf).toISOString().slice(0, 10) : null,
          retention_reason: r.retention_reason || null,
          growth_status: r.growth_status || null,
          billing_cycle: r.billing_cycle || 'NAO_CLASSIFICADO',
          rental_period_description: r.rental_period_description || null,
          rental_period_days: r.rental_period_days == null ? null : Number(r.rental_period_days),
          contract_periods: r.contract_periods == null ? null : Number(r.contract_periods),
          contract_horizon: r.contract_horizon || 'NAO_CLASSIFICADO',
          contract_horizon_days: r.contract_horizon_days == null ? null : Number(r.contract_horizon_days),
          latest_contract_id: r.latest_contract_id == null ? null : String(r.latest_contract_id),
          fichas_abertas: Number(r.fichas_abertas) || 0,
          latest_contract_start: r.latest_contract_start ? new Date(r.latest_contract_start).toISOString().slice(0, 10) : null,
          latest_contract_end: r.latest_contract_end ? new Date(r.latest_contract_end).toISOString().slice(0, 10) : null,
          latest_contract_closed: r.latest_contract_closed ? new Date(r.latest_contract_closed).toISOString().slice(0, 10) : null,
          latest_expected_return: r.latest_expected_return ? new Date(r.latest_expected_return).toISOString().slice(0, 10) : null,
          last_contract_generation: r.last_contract_generation ? new Date(r.last_contract_generation).toISOString().slice(0, 10) : null,
          next_contract_billing: r.next_contract_billing ? new Date(r.next_contract_billing).toISOString().slice(0, 10) : null,
          contract_billing_alert: Boolean(r.contract_billing_alert),
          analysis_revenue: Number(r.analysis_revenue) || 0,
          analysis_nfs: Number(r.analysis_nfs) || 0,
          prim_dt_pedido: f.prim_dt_pedido ? new Date(f.prim_dt_pedido).toISOString().slice(0, 10) : null,
          ult_dt_pedido: f.ult_dt_pedido ? new Date(f.ult_dt_pedido).toISOString().slice(0, 10) : null,
          ult_dt_enc_ficha: f.ult_dt_enc_ficha ? new Date(f.ult_dt_enc_ficha).toISOString().slice(0, 10) : null,
          total_contratos: Number(f.total_contratos) || 0,
          qtd_renovacoes: Number(f.qtd_renovacoes) || 0,
          total_encerramento: Number(f.total_encerramento) || 0,
          produtos_locados: m.produtos_locados || null,
          codigos_equipto: m.codigos_equipto || null,
          total_qt_locado: Number(m.total_qt) || 0,
          total_valor_locado: Number(m.total_valor) || 0,
        };
      }),
      monthly_churn: monthlyChurnArray,
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message || String(error) }, { status: 500 });
  }
});