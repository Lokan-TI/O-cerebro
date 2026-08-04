import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { waitUntil } from 'base44:runtime';
import { buildConfig, runQuery } from '../../shared/erpConnection.ts';

const STEPS = [
  { id: 'conectando', label: 'Conectando ao banco' },
  { id: 'verificando_estrutura', label: 'Verificando estrutura' },
  { id: 'extraindo_kpis', label: 'Extraindo indicadores financeiros' },
  { id: 'extraindo_clientes', label: 'Extraindo clientes' },
  { id: 'extraindo_vendedores', label: 'Extraindo vendedores' },
  { id: 'extraindo_mensal', label: 'Extraindo série mensal' },
  { id: 'calculando_kpis', label: 'Calculando KPIs' },
  { id: 'validando', label: 'Validando dados' },
  { id: 'publicando', label: 'Publicando nova versão' },
];

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
    if (user.role !== 'admin') {
      return Response.json({ success: false, error: 'Apenas administradores e analistas podem atualizar dados.' }, { status: 403 });
    }

    const body = await req.json();
    const sourceId = body?.source_id;
    if (!sourceId) return Response.json({ success: false, error: 'source_id é obrigatório.' });

    const source = await base44.asServiceRole.entities.ErpDataSource.get(sourceId);
    if (!source) return Response.json({ success: false, error: 'Fonte de dados não encontrada.' });

    // Cleanup stale runs (running for > 5 min → worker interrompido)
    const staleThreshold = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const staleRuns = await base44.asServiceRole.entities.ErpSyncRun.filter({
      source_id: sourceId, status: 'running', started_at: { $lt: staleThreshold }
    });
    for (const sr of staleRuns) {
      await base44.asServiceRole.entities.ErpSyncRun.update(sr.id, {
        status: 'failed',
        error_message: 'Processamento interrompido (timeout do worker).',
        completed_at: new Date().toISOString()
      });
    }

    // Concurrency check — uma atualização por fonte
    const running = await base44.asServiceRole.entities.ErpSyncRun.filter({
      source_id: sourceId, status: 'running'
    });
    if (running.length > 0) {
      return Response.json({
        success: false,
        already_running: true,
        error: `Já existe uma atualização da fonte ${source.name} em processamento.`,
        run: {
          id: running[0].id,
          started_at: running[0].started_at,
          started_by_name: running[0].started_by_name,
          step_label: running[0].step_label,
          progress: running[0].progress
        }
      });
    }

    // Versão anterior
    const currentSnaps = await base44.asServiceRole.entities.ErpSnapshot.filter({
      source_id: sourceId, is_current: true
    }, '-created_date', 1);
    const previousVersion = currentSnaps[0]?.version || null;

    // Gerar ID da versão
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const sourceSlug = source.name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
    const version = `${sourceSlug}-${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

    // Criar registro da execução
    const run = await base44.asServiceRole.entities.ErpSyncRun.create({
      source_id: sourceId,
      source_name: source.name,
      version,
      previous_version: previousVersion,
      status: 'running',
      started_at: now.toISOString(),
      started_by_id: user.id,
      started_by_name: user.full_name || user.email,
      current_step: STEPS[0].id,
      step_label: STEPS[0].label,
      step_index: 1,
      total_steps: STEPS.length,
      progress: 5,
    });

    // Iniciar processamento em segundo plano
    waitUntil(processRefresh(base44, source, run, version, previousVersion));

    return Response.json({
      success: true,
      run_id: run.id,
      version,
      message: 'Atualização iniciada em segundo plano.'
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message || String(error) }, { status: 500 });
  }
});

async function processRefresh(base44, source, run, version, previousVersion) {
  const startTime = Date.now();
  let queryCount = 0;
  const warnings = [];

  const updateStep = async (stepIndex, progress, extra) => {
    const step = STEPS[stepIndex];
    try {
      await base44.asServiceRole.entities.ErpSyncRun.update(run.id, {
        current_step: step.id,
        step_label: step.label,
        step_index: stepIndex + 1,
        progress,
        ...(extra || {})
      });
    } catch {}
  };

  try {
    const config = buildConfig(source);
    if (!config) throw new Error('Configuração de conexão incompleta para a fonte.');

    const wrap = (inner) => config.clientId
      ? `EXEC DW_API '${config.clientId}', '${inner.replace(/'/g, "''")}'`
      : inner;

    // Etapa 1: Conectar
    await runQuery(source, wrap('SELECT 1 AS ok'));
    queryCount++;
    await updateStep(1, 10);

    // Etapa 2: Verificar estrutura + fl_can_nf (char 'S'/'N' ou int 0/1)
    let cancelFilter = '';
    try {
      const checkRes = await runQuery(source, wrap("SELECT TOP 1 fl_can_nf AS v FROM nf WHERE fl_can_nf IS NOT NULL"));
      queryCount++;
      const checkRow = getRows(checkRes)[0];
      if (checkRow && checkRow.v != null) {
        if (typeof checkRow.v === 'string') {
          cancelFilter = "AND fl_can_nf <> 'S'";
        } else {
          cancelFilter = 'AND fl_can_nf = 0';
        }
      }
    } catch {
      warnings.push('Coluna fl_can_nf não encontrada — notas canceladas não foram filtradas.');
    }
    await updateStep(2, 15);

    // Fragmentos de data
    const yearStart = 'DATEFROMPARTS(YEAR(GETDATE()),1,1)';
    const yearEnd = 'DATEADD(year,1,DATEFROMPARTS(YEAR(GETDATE()),1,1))';
    const lastYearStart = 'DATEFROMPARTS(YEAR(GETDATE())-1,1,1)';
    const monthStart = 'DATEFROMPARTS(YEAR(GETDATE()),MONTH(GETDATE()),1)';
    const monthEnd = 'DATEADD(month,1,DATEFROMPARTS(YEAR(GETDATE()),MONTH(GETDATE()),1))';
    const prevMonthStart = 'DATEADD(month,-1,DATEFROMPARTS(YEAR(GETDATE()),MONTH(GETDATE()),1))';

    // Etapa 3: KPIs combinados (único scan da tabela nf)
    await updateStep(3, 20);
    const kpiSql = `SELECT
      ISNULL(SUM(CASE WHEN dt_emi_nf >= ${yearStart} AND dt_emi_nf < ${yearEnd} THEN vl_faturamento ELSE 0 END),0) AS fat_ano,
      ISNULL(SUM(CASE WHEN dt_emi_nf >= ${lastYearStart} AND dt_emi_nf < ${yearStart} THEN vl_faturamento ELSE 0 END),0) AS fat_ano_ant,
      ISNULL(SUM(CASE WHEN dt_emi_nf >= ${monthStart} AND dt_emi_nf < ${monthEnd} THEN vl_faturamento ELSE 0 END),0) AS fat_mes,
      ISNULL(SUM(CASE WHEN dt_emi_nf >= ${prevMonthStart} AND dt_emi_nf < ${monthStart} THEN vl_faturamento ELSE 0 END),0) AS fat_mes_ant,
      COUNT(CASE WHEN dt_emi_nf >= ${monthStart} AND dt_emi_nf < ${monthEnd} THEN 1 END) AS nfs_mes,
      COUNT(CASE WHEN dt_emi_nf >= ${yearStart} AND dt_emi_nf < ${yearEnd} THEN 1 END) AS nfs_ano,
      COUNT(DISTINCT CASE WHEN dt_emi_nf >= ${monthStart} AND dt_emi_nf < ${monthEnd} THEN cd_pessoa END) AS clientes_mes,
      COUNT(DISTINCT CASE WHEN dt_emi_nf >= ${yearStart} AND dt_emi_nf < ${yearEnd} THEN cd_pessoa END) AS clientes_ano,
      ISNULL(SUM(CASE WHEN dt_emi_nf >= ${yearStart} AND dt_emi_nf < ${yearEnd} THEN vl_faturamento ELSE 0 END),0) / NULLIF(COUNT(CASE WHEN dt_emi_nf >= ${yearStart} AND dt_emi_nf < ${yearEnd} THEN 1 END),0) AS ticket_ano,
      ISNULL(SUM(CASE WHEN dt_emi_nf >= ${monthStart} AND dt_emi_nf < ${monthEnd} THEN vl_faturamento ELSE 0 END),0) / NULLIF(COUNT(CASE WHEN dt_emi_nf >= ${monthStart} AND dt_emi_nf < ${monthEnd} THEN 1 END),0) AS ticket_mes,
      MAX(dt_emi_nf) AS max_date
    FROM nf WHERE dt_emi_nf >= ${lastYearStart} AND dt_emi_nf < ${yearEnd} ${cancelFilter}`;

    const kpiRes = await runQuery(source, wrap(kpiSql));
    queryCount++;
    const kpiRow = getRows(kpiRes)[0] || {};
    await updateStep(4, 35);

    // Etapa 4: Top 100 clientes
    const topClientsSql = `SELECT TOP 100 cd_pessoa, ISNULL(SUM(vl_faturamento),0) AS total, COUNT(*) AS nfs, MAX(dt_emi_nf) AS ultima_nf
      FROM nf WHERE dt_emi_nf >= ${yearStart} AND dt_emi_nf < ${yearEnd} ${cancelFilter}
      GROUP BY cd_pessoa ORDER BY ISNULL(SUM(vl_faturamento),0) DESC`;
    const topClientsRes = await runQuery(source, wrap(topClientsSql));
    queryCount++;
    const topClients = getRows(topClientsRes).map(r => ({
      cd_pessoa: String(r.cd_pessoa || ''),
      total: Number(r.total) || 0,
      nfs: Number(r.nfs) || 0,
      ultima_nf: r.ultima_nf ? String(r.ultima_nf).slice(0, 10) : null
    }));
    await updateStep(5, 50);

    // Etapa 5: Top 10 vendedores
    let topVendors = [];
    try {
      const topVendorsSql = `SELECT TOP 10 cd_vendedor, ISNULL(SUM(vl_faturamento),0) AS total, COUNT(*) AS nfs
        FROM nf WHERE dt_emi_nf >= ${yearStart} AND dt_emi_nf < ${yearEnd} ${cancelFilter}
        GROUP BY cd_vendedor ORDER BY ISNULL(SUM(vl_faturamento),0) DESC`;
      const tvRes = await runQuery(source, wrap(topVendorsSql));
      queryCount++;
      topVendors = getRows(tvRes).map(r => ({
        cd_vendedor: String(r.cd_vendedor || ''),
        total: Number(r.total) || 0,
        nfs: Number(r.nfs) || 0
      }));
    } catch (e) {
      warnings.push('Falha ao extrair top vendedores: ' + (e.message || String(e)));
    }
    await updateStep(6, 65);

    // Etapa 6: Série mensal (12 meses)
    const monthlySql = `SELECT YEAR(dt_emi_nf) AS ano, MONTH(dt_emi_nf) AS mes, ISNULL(SUM(vl_faturamento),0) AS valor, COUNT(*) AS nfs, COUNT(DISTINCT cd_pessoa) AS clientes
      FROM nf WHERE dt_emi_nf >= DATEADD(month,-12,${monthStart}) AND dt_emi_nf < ${monthEnd} ${cancelFilter}
      GROUP BY YEAR(dt_emi_nf), MONTH(dt_emi_nf) ORDER BY 1, 2`;
    const monthlyRes = await runQuery(source, wrap(monthlySql));
    queryCount++;
    const monthlyRevenue = getRows(monthlyRes).map(r => ({
      ano: Number(r.ano),
      mes: Number(r.mes),
      valor: Number(r.valor) || 0,
      nfs: Number(r.nfs) || 0,
      clientes: Number(r.clientes) || 0
    }));
    await updateStep(7, 80);

    // Etapa 7: Calcular KPIs derivados
    const kpis = {
      fat_ano: Number(kpiRow.fat_ano) || 0,
      fat_ano_ant: Number(kpiRow.fat_ano_ant) || 0,
      fat_mes: Number(kpiRow.fat_mes) || 0,
      fat_mes_ant: Number(kpiRow.fat_mes_ant) || 0,
      nfs_mes: Number(kpiRow.nfs_mes) || 0,
      nfs_ano: Number(kpiRow.nfs_ano) || 0,
      clientes_mes: Number(kpiRow.clientes_mes) || 0,
      clientes_ano: Number(kpiRow.clientes_ano) || 0,
      ticket_ano: Number(kpiRow.ticket_ano) || 0,
      ticket_mes: Number(kpiRow.ticket_mes) || 0,
      crescimento_ano: Number(kpiRow.fat_ano_ant) > 0 ? ((Number(kpiRow.fat_ano) - Number(kpiRow.fat_ano_ant)) / Number(kpiRow.fat_ano_ant) * 100) : null,
      crescimento_mes: Number(kpiRow.fat_mes_ant) > 0 ? ((Number(kpiRow.fat_mes) - Number(kpiRow.fat_mes_ant)) / Number(kpiRow.fat_mes_ant) * 100) : null,
    };
    const top10Total = topClients.slice(0, 10).reduce((s, c) => s + c.total, 0);
    kpis.concentracao_top10 = kpis.fat_ano > 0 ? (top10Total / kpis.fat_ano * 100) : 0;
    await updateStep(7, 85);

    // Etapa 8: Validar
    const maxDate = kpiRow.max_date;
    const maxDateStr = maxDate ? new Date(maxDate).toISOString().slice(0, 10) : null;
    const totalRecords = kpis.clientes_ano + kpis.nfs_ano;
    await updateStep(8, 90);

    // Criar snapshot (não publicado ainda)
    const snapshot = await base44.asServiceRole.entities.ErpSnapshot.create({
      source_id: run.source_id,
      source_name: run.source_name,
      version,
      run_id: run.id,
      is_current: false,
      created_at: new Date().toISOString(),
      max_date: maxDateStr,
      record_count: totalRecords,
      kpis,
      top_clients: topClients,
      top_vendors: topVendors,
      monthly_revenue: monthlyRevenue,
      clients_total: kpis.clientes_ano,
      query_count: queryCount,
      duration_ms: Date.now() - startTime,
    });

    // Etapa 9: Publicar — desmarcar anterior, marcar nova
    await updateStep(9, 95);
    if (previousVersion) {
      await base44.asServiceRole.entities.ErpSnapshot.updateMany(
        { source_id: run.source_id, is_current: true },
        { $set: { is_current: false } }
      );
    }
    await base44.asServiceRole.entities.ErpSnapshot.update(snapshot.id, { is_current: true });

    // Concluir execução
    const completedAt = new Date();
    const durationMs = completedAt.getTime() - startTime;
    await base44.asServiceRole.entities.ErpSyncRun.update(run.id, {
      status: warnings.length > 0 ? 'partial' : 'success',
      completed_at: completedAt.toISOString(),
      current_step: 'concluido',
      step_label: 'Concluído',
      progress: 100,
      duration_ms: durationMs,
      records_extracted: queryCount,
      records_valid: totalRecords,
      records_rejected: 0,
      warning_count: warnings.length,
      warnings: warnings.slice(0, 20),
      max_date: maxDateStr,
    });

    // Atualizar metadados da fonte
    await base44.asServiceRole.entities.ErpDataSource.update(run.source_id, {
      last_successful_sync: completedAt.toISOString(),
      last_sync_status: warnings.length > 0 ? 'partial' : 'success',
      records_count: totalRecords,
    });
  } catch (err) {
    // Marcar como falha — versão anterior permanece ativa
    const completedAt = new Date();
    try {
      await base44.asServiceRole.entities.ErpSyncRun.update(run.id, {
        status: 'failed',
        completed_at: completedAt.toISOString(),
        current_step: 'erro',
        step_label: 'Erro no processamento',
        error_message: (err.message || String(err)).slice(0, 500),
        duration_ms: completedAt.getTime() - startTime,
        records_extracted: queryCount,
        warning_count: warnings.length,
        warnings: warnings.slice(0, 20),
      });
    } catch {}
  }
}