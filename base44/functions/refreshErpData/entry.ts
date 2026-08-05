import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { buildConfig, runQuery } from '../../shared/erpConnection.ts';

const STEPS = [
  { id: 'conectando', label: 'Conectando ao banco' },
  { id: 'verificando_estrutura', label: 'Verificando estrutura' },
  { id: 'extraindo_kpis', label: 'Extraindo indicadores financeiros' },
  { id: 'extraindo_clientes', label: 'Extraindo clientes' },
  { id: 'extraindo_vendedores', label: 'Extraindo vendedores' },
  { id: 'extraindo_mensal', label: 'Extraindo série mensal' },
  { id: 'extraindo_coorte', label: 'Extraindo coorte de clientes' },
  { id: 'extraindo_geografico', label: 'Extraindo distribuição geográfica' },
  { id: 'extraindo_empresas', label: 'Extraindo KPIs por empresa' },
  { id: 'calculando_kpis', label: 'Calculando KPIs e alertas' },
  { id: 'validando', label: 'Validando dados' },
  { id: 'publicando', label: 'Publicando nova versão' },
];

function generateAlerts(kpis, topClients) {
  const alerts = [];

  // 1. Concentração excessiva de receita
  if (kpis.concentracao_top10 > 25) {
    alerts.push({
      type: 'risk', severity: kpis.concentracao_top10 > 40 ? 'critical' : 'warning',
      title: 'Concentração excessiva de receita',
      message: `Top 10 clientes concentram ${kpis.concentracao_top10.toFixed(1)}% da receita anual. Perda de um grande cliente teria alto impacto.`,
      impact: kpis.fat_ano * (kpis.concentracao_top10 / 100) * 0.3,
    });
  }

  // 2. Queda na receita anual
  if (kpis.crescimento_ano != null && kpis.crescimento_ano < 0) {
    alerts.push({
      type: 'attention', severity: kpis.crescimento_ano < -15 ? 'critical' : 'warning',
      title: 'Queda na receita anual',
      message: `A receita anual caiu ${Math.abs(kpis.crescimento_ano).toFixed(1)}% em relação ao ano anterior.`,
      impact: kpis.fat_ano_ant - kpis.fat_ano,
    });
  }

  // 3. Queda na receita mensal
  if (kpis.crescimento_mes != null && kpis.crescimento_mes < -10) {
    alerts.push({
      type: 'attention', severity: 'warning',
      title: 'Queda na receita mensal',
      message: `A receita do mês atual caiu ${Math.abs(kpis.crescimento_mes).toFixed(1)}% vs. mês anterior.`,
      impact: kpis.fat_mes_ant - kpis.fat_mes,
    });
  }

  // 4. Churn de clientes elevado
  if (kpis.churn_rate != null && kpis.churn_rate > 20) {
    alerts.push({
      type: 'risk', severity: kpis.churn_rate > 35 ? 'critical' : 'warning',
      title: 'Churn de clientes elevado',
      message: `${kpis.churned_clients} clientes do ano anterior não voltaram a alugar (churn de ${kpis.churn_rate.toFixed(1)}%).`,
      impact: null,
    });
  }

  // 5. Baixa retenção
  if (kpis.retention_rate != null && kpis.retention_rate < 60) {
    alerts.push({
      type: 'risk', severity: 'warning',
      title: 'Taxa de retenção baixa',
      message: `Apenas ${kpis.retention_rate.toFixed(1)}% dos clientes do ano anterior continuaram alugando este ano.`,
      impact: null,
    });
  }

  // 6. Dependência de cliente principal
  if (topClients && topClients.length > 0 && kpis.fat_ano > 0) {
    const top1Share = (topClients[0].total / kpis.fat_ano) * 100;
    if (top1Share > 10) {
      alerts.push({
        type: 'risk', severity: top1Share > 20 ? 'critical' : 'warning',
        title: 'Dependência de cliente principal',
        message: `O maior cliente (ID ${topClients[0].cd_pessoa}) representa ${top1Share.toFixed(1)}% da receita anual.`,
        impact: topClients[0].total,
      });
    }
  }

  // 7. Oportunidade: crescimento positivo
  if (kpis.crescimento_ano != null && kpis.crescimento_ano > 15) {
    alerts.push({
      type: 'opportunity', severity: 'info',
      title: 'Crescimento anual expressivo',
      message: `A receita anual cresceu ${kpis.crescimento_ano.toFixed(1)}% vs. ano anterior. Avaliar investimento em retenção da base.`,
      impact: kpis.fat_ano - kpis.fat_ano_ant,
    });
  }

  return alerts;
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

    // Processar sincronamente — o frontend dispara sem aguardar e consulta o status
    const result = await processRefresh(base44, source, run, version, previousVersion);

    return Response.json({
      success: result.status === 'success' || result.status === 'partial',
      run_id: run.id,
      version,
      status: result.status,
      message: result.status === 'success'
        ? 'Atualização concluída com sucesso.'
        : result.status === 'partial'
          ? 'Atualização concluída com avisos.'
          : (result.error || 'Falha na atualização.')
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
    // YTD: mesmo período do ano anterior (jan até hoje, ano passado)
    const lastYearEnd = 'DATEADD(year,-1,GETDATE())';
    const lastMonthStart = 'DATEFROMPARTS(YEAR(GETDATE())-1,MONTH(GETDATE()),1)';
    const lastMonthEnd = 'DATEADD(month,1,DATEFROMPARTS(YEAR(GETDATE())-1,MONTH(GETDATE()),1))';

    // Etapa 3: KPIs combinados (único scan da tabela nf) — timeout estendido (ETL fire-and-forget)
    await updateStep(3, 20);
    let kpiRow = {};
    try {
      const kpiSql = `SELECT
        ISNULL(SUM(CASE WHEN dt_emi_nf >= ${yearStart} AND dt_emi_nf < ${yearEnd} THEN vl_faturamento ELSE 0 END),0) AS fat_ano,
        ISNULL(SUM(CASE WHEN dt_emi_nf >= ${lastYearStart} AND dt_emi_nf < ${lastYearEnd} THEN vl_faturamento ELSE 0 END),0) AS fat_ano_ant,
        ISNULL(SUM(CASE WHEN dt_emi_nf >= ${monthStart} AND dt_emi_nf < ${monthEnd} THEN vl_faturamento ELSE 0 END),0) AS fat_mes,
        ISNULL(SUM(CASE WHEN dt_emi_nf >= ${lastMonthStart} AND dt_emi_nf < ${lastMonthEnd} THEN vl_faturamento ELSE 0 END),0) AS fat_mes_ant,
        COUNT(CASE WHEN dt_emi_nf >= ${monthStart} AND dt_emi_nf < ${monthEnd} THEN 1 END) AS nfs_mes,
        COUNT(CASE WHEN dt_emi_nf >= ${yearStart} AND dt_emi_nf < ${yearEnd} THEN 1 END) AS nfs_ano,
        COUNT(DISTINCT CASE WHEN dt_emi_nf >= ${monthStart} AND dt_emi_nf < ${monthEnd} THEN cd_pessoa END) AS clientes_mes,
        COUNT(DISTINCT CASE WHEN dt_emi_nf >= ${yearStart} AND dt_emi_nf < ${yearEnd} THEN cd_pessoa END) AS clientes_ano,
        ISNULL(SUM(CASE WHEN dt_emi_nf >= ${yearStart} AND dt_emi_nf < ${yearEnd} THEN vl_faturamento ELSE 0 END),0) / NULLIF(COUNT(CASE WHEN dt_emi_nf >= ${yearStart} AND dt_emi_nf < ${yearEnd} THEN 1 END),0) AS ticket_ano,
        ISNULL(SUM(CASE WHEN dt_emi_nf >= ${monthStart} AND dt_emi_nf < ${monthEnd} THEN vl_faturamento ELSE 0 END),0) / NULLIF(COUNT(CASE WHEN dt_emi_nf >= ${monthStart} AND dt_emi_nf < ${monthEnd} THEN 1 END),0) AS ticket_mes,
        MAX(dt_emi_nf) AS max_date
      FROM nf WHERE dt_emi_nf >= ${lastYearStart} AND dt_emi_nf < ${yearEnd} ${cancelFilter}`;

      const kpiRes = await runQuery(source, wrap(kpiSql), 30000);
      queryCount++;
      kpiRow = getRows(kpiRes)[0] || {};
    } catch (e) {
      warnings.push('Falha ao extrair KPIs combinados: ' + (e.message || String(e)).slice(0, 120));
    }

    // Clientes ativos por locação (fich_loc) — global distinto e por empresa (universo de locação)
    let fichClients = { ano: 0, mes: 0 };
    let fichEmpClients = {};
    try {
      const fecSql = `SELECT cd_empresa,
        COUNT(DISTINCT CASE WHEN dt_pedido >= ${yearStart} AND dt_pedido < ${yearEnd} THEN cd_pessoa END) AS clientes_ano,
        COUNT(DISTINCT CASE WHEN dt_pedido >= ${monthStart} AND dt_pedido < ${monthEnd} THEN cd_pessoa END) AS clientes_mes
        FROM fich_loc WITH (NOLOCK)
        WHERE dt_pedido >= ${lastYearStart} AND dt_pedido < ${yearEnd}
          AND cd_pessoa IS NOT NULL AND cd_pessoa <> ''
        GROUP BY cd_empresa`;
      const fecRes = await runQuery(source, wrap(fecSql), 30000);
      queryCount++;
      for (const r of getRows(fecRes)) {
        const ce = Number(r.cd_empresa);
        fichEmpClients[ce] = { ano: Number(r.clientes_ano) || 0, mes: Number(r.clientes_mes) || 0 };
      }
      // Contagem global distinta (evita dupla contagem de clientes multi-empresa)
      const gSql = `SELECT
        COUNT(DISTINCT CASE WHEN dt_pedido >= ${yearStart} AND dt_pedido < ${yearEnd} THEN cd_pessoa END) AS clientes_ano,
        COUNT(DISTINCT CASE WHEN dt_pedido >= ${monthStart} AND dt_pedido < ${monthEnd} THEN cd_pessoa END) AS clientes_mes
        FROM fich_loc WITH (NOLOCK)
        WHERE dt_pedido >= ${lastYearStart} AND dt_pedido < ${yearEnd}
          AND cd_pessoa IS NOT NULL AND cd_pessoa <> ''`;
      const gRes = await runQuery(source, wrap(gSql), 30000);
      queryCount++;
      const gRow = getRows(gRes)[0] || {};
      fichClients = { ano: Number(gRow.clientes_ano) || 0, mes: Number(gRow.clientes_mes) || 0 };
    } catch (e) { warnings.push('Falha ao extrair clientes fich_loc: ' + (e.message || String(e)).slice(0, 120)); }
    await updateStep(4, 35);

    // Etapa 4: Top 100 clientes — timeout estendido
    let topClients = [];
    try {
      const topClientsSql = `SELECT TOP 100 cd_pessoa, ISNULL(SUM(vl_faturamento),0) AS total, COUNT(*) AS nfs, MAX(dt_emi_nf) AS ultima_nf
        FROM nf WHERE dt_emi_nf >= ${yearStart} AND dt_emi_nf < ${yearEnd} ${cancelFilter}
        GROUP BY cd_pessoa ORDER BY ISNULL(SUM(vl_faturamento),0) DESC`;
      const topClientsRes = await runQuery(source, wrap(topClientsSql), 30000);
      queryCount++;
      topClients = getRows(topClientsRes).map(r => ({
        cd_pessoa: String(r.cd_pessoa || ''),
        total: Number(r.total) || 0,
        nfs: Number(r.nfs) || 0,
        ultima_nf: r.ultima_nf ? new Date(r.ultima_nf).toISOString().slice(0, 10) : null
      }));
    } catch (e) {
      warnings.push('Falha ao extrair top clientes: ' + (e.message || String(e)).slice(0, 120));
    }
    await updateStep(5, 50);

    // Etapa 5: Top 10 vendedores (cd_pessoa_fun = funcionário/vendedor)
    let topVendors = [];
    try {
      const topVendorsSql = `SELECT TOP 10 cd_pessoa_fun, ISNULL(SUM(vl_faturamento),0) AS total, COUNT(*) AS nfs
        FROM nf WHERE dt_emi_nf >= ${yearStart} AND dt_emi_nf < ${yearEnd} ${cancelFilter}
          AND cd_pessoa_fun IS NOT NULL
        GROUP BY cd_pessoa_fun ORDER BY ISNULL(SUM(vl_faturamento),0) DESC`;
      const tvRes = await runQuery(source, wrap(topVendorsSql), 30000);
      queryCount++;
      topVendors = getRows(tvRes).map(r => ({
        cd_pessoa_fun: Number(r.cd_pessoa_fun) || 0,
        total: Number(r.total) || 0,
        nfs: Number(r.nfs) || 0
      }));
    } catch (e) {
      warnings.push('Falha ao extrair top vendedores: ' + (e.message || String(e)).slice(0, 120));
    }

    // Etapa 5b: Resolução de nomes (clientes + vendedores) via pessoa
    try {
      const codes = [...new Set([
        ...topClients.map(c => Number(c.cd_pessoa)),
        ...topVendors.map(v => v.cd_pessoa_fun),
      ])].filter(Boolean);
      const nameMap = {};
      for (let i = 0; i < codes.length; i += 200) {
        const batch = codes.slice(i, i + 200);
        try {
          const namesSql = `SELECT cd_pessoa, nm_pessoa, nm_fan_pessoa FROM pessoa WITH (NOLOCK) WHERE cd_pessoa IN (${batch.join(',')})`;
          for (const r of getRows(await runQuery(source, wrap(namesSql)))) {
            nameMap[Number(r.cd_pessoa)] = String(r.nm_fan_pessoa || r.nm_pessoa || '');
          }
          queryCount++;
        } catch {}
      }
      topClients = topClients.map(c => ({
        ...c,
        nm_pessoa: nameMap[Number(c.cd_pessoa)] || `Cliente ${c.cd_pessoa}`,
      }));
      topVendors = topVendors.map(v => ({
        ...v,
        nm_pessoa: nameMap[v.cd_pessoa_fun] || `Vendedor ${v.cd_pessoa_fun}`,
      }));
    } catch (e) {
      warnings.push('Falha ao resolver nomes: ' + (e.message || String(e)).slice(0, 120));
    }
    await updateStep(6, 65);

    // Etapa 6: Série mensal (12 meses) — timeout estendido
    let monthlyRevenue = [];
    try {
      const monthlySql = `SELECT YEAR(dt_emi_nf) AS ano, MONTH(dt_emi_nf) AS mes, ISNULL(SUM(vl_faturamento),0) AS valor, COUNT(*) AS nfs, COUNT(DISTINCT cd_pessoa) AS clientes
        FROM nf WHERE dt_emi_nf >= DATEADD(month,-12,${monthStart}) AND dt_emi_nf < ${monthEnd} ${cancelFilter}
        GROUP BY YEAR(dt_emi_nf), MONTH(dt_emi_nf) ORDER BY 1, 2`;
      const monthlyRes = await runQuery(source, wrap(monthlySql), 30000);
      queryCount++;
      monthlyRevenue = getRows(monthlyRes).map(r => ({
        ano: Number(r.ano),
        mes: Number(r.mes),
        valor: Number(r.valor) || 0,
        nfs: Number(r.nfs) || 0,
        clientes: Number(r.clientes) || 0
      }));
    } catch (e) {
      warnings.push('Falha ao extrair série mensal: ' + (e.message || String(e)).slice(0, 120));
    }
    await updateStep(6, 65);

    // Etapa 7: Coorte de clientes (universo de locação fich_loc; receita proxy do nf)
    let cohortKpis = {};
    try {
      // Classificação pelo universo de locação (fich_loc)
      const classSql = `SELECT cd_pessoa,
          MAX(CASE WHEN dt_pedido >= ${lastYearStart} AND dt_pedido < ${yearStart} THEN 1 ELSE 0 END) AS last_yr,
          MAX(CASE WHEN dt_pedido >= ${yearStart} AND dt_pedido < ${yearEnd} THEN 1 ELSE 0 END) AS this_yr
        FROM fich_loc WITH (NOLOCK)
        WHERE dt_pedido >= ${lastYearStart} AND dt_pedido < ${yearEnd}
          AND cd_pessoa IS NOT NULL AND cd_pessoa <> ''
        GROUP BY cd_pessoa`;
      const classRes = await runQuery(source, wrap(classSql), 30000);
      queryCount++;
      const classRows = getRows(classRes);
      let retained = 0, newC = 0, churned = 0, clientsLastYear = 0;
      const newSet = new Set(), retainedSet = new Set();
      for (const r of classRows) {
        const ly = Number(r.last_yr) || 0, ty = Number(r.this_yr) || 0;
        const code = String(r.cd_pessoa);
        if (ly === 1) clientsLastYear++;
        if (ly === 1 && ty === 1) { retained++; retainedSet.add(code); }
        if (ty === 1 && ly === 0) { newC++; newSet.add(code); }
        if (ly === 1 && ty === 0) churned++;
      }
      // Receita do ano (nf) por cliente — proxy para novos e recorrentes
      let newRevenue = 0, retainedRevenue = 0;
      try {
        const revSql = `SELECT cd_pessoa, ISNULL(SUM(vl_faturamento),0) AS rev
          FROM nf WITH (NOLOCK)
          WHERE dt_emi_nf >= ${yearStart} AND dt_emi_nf < ${yearEnd} ${cancelFilter}
            AND cd_pessoa IS NOT NULL AND cd_pessoa <> ''
          GROUP BY cd_pessoa`;
        for (const r of getRows(await runQuery(source, wrap(revSql), 30000))) {
          const code = String(r.cd_pessoa);
          const v = Number(r.rev) || 0;
          if (retainedSet.has(code)) retainedRevenue += v;
          else if (newSet.has(code)) newRevenue += v;
        }
        queryCount++;
      } catch (e) { warnings.push('Falha ao extrair receita coorte: ' + (e.message || String(e)).slice(0, 120)); }
      cohortKpis = {
        retained_clients: retained,
        new_clients: newC,
        churned_clients: churned,
        clients_last_year: clientsLastYear,
        retention_rate: clientsLastYear > 0 ? (retained / clientsLastYear * 100) : null,
        churn_rate: clientsLastYear > 0 ? (churned / clientsLastYear * 100) : null,
        new_client_revenue: newRevenue,
        retained_revenue: retainedRevenue,
      };
    } catch (e) {
      warnings.push('Falha ao extrair coorte de clientes: ' + (e.message || String(e)).slice(0, 120));
    }
    await updateStep(7, 72);

    // Etapa 8: Novos clientes por mês (primeira locação — fich_loc)
    let newClientsMonthly = [];
    try {
      const ncmSql = `SELECT YEAR(first_ficha) AS ano, MONTH(first_ficha) AS mes, COUNT(*) AS new_clients
        FROM (
          SELECT cd_pessoa, MIN(dt_pedido) AS first_ficha
          FROM fich_loc WITH (NOLOCK)
          WHERE dt_pedido >= ${lastYearStart} AND dt_pedido < ${yearEnd}
            AND cd_pessoa IS NOT NULL AND cd_pessoa <> ''
          GROUP BY cd_pessoa
        ) x
        WHERE first_ficha >= ${yearStart} AND first_ficha < ${yearEnd}
        GROUP BY YEAR(first_ficha), MONTH(first_ficha)
        ORDER BY 1, 2`;
      const ncmRes = await runQuery(source, wrap(ncmSql), 30000);
      queryCount++;
      newClientsMonthly = getRows(ncmRes).map(r => ({
        ano: Number(r.ano), mes: Number(r.mes), new_clients: Number(r.new_clients) || 0
      }));
    } catch (e) {
      warnings.push('Falha ao extrair novos clientes mensais: ' + (e.message || String(e)).slice(0, 120));
    }

    // Etapa 9: Distribuição geográfica
    let revenueByState = [];
    try {
      const geoSql = `SELECT TOP 15 uf_destinatario AS uf, ISNULL(SUM(vl_faturamento),0) AS revenue, COUNT(*) AS nfs, COUNT(DISTINCT cd_pessoa) AS clients
        FROM nf WITH (NOLOCK)
        WHERE dt_emi_nf >= ${yearStart} AND dt_emi_nf < ${yearEnd} ${cancelFilter}
          AND uf_destinatario IS NOT NULL AND uf_destinatario <> ''
        GROUP BY uf_destinatario
        ORDER BY ISNULL(SUM(vl_faturamento),0) DESC`;
      const geoRes = await runQuery(source, wrap(geoSql), 30000);
      queryCount++;
      revenueByState = getRows(geoRes).map(r => ({
        uf: String(r.uf || ''),
        revenue: Number(r.revenue) || 0,
        nfs: Number(r.nfs) || 0,
        clients: Number(r.clients) || 0,
      }));
    } catch (e) {
      warnings.push('Falha ao extrair distribuição geográfica: ' + (e.message || String(e)).slice(0, 120));
    }
    await updateStep(8, 82);

    // Etapa: KPIs por empresa (matriz e filiais)
    let byEmpresa = [];
    try {
      const empKpiSql = `SELECT
        nf.cd_empresa,
        ISNULL(SUM(CASE WHEN nf.dt_emi_nf >= ${yearStart} AND nf.dt_emi_nf < ${yearEnd} THEN nf.vl_faturamento ELSE 0 END),0) AS fat_ano,
        ISNULL(SUM(CASE WHEN nf.dt_emi_nf >= ${lastYearStart} AND nf.dt_emi_nf < ${lastYearEnd} THEN nf.vl_faturamento ELSE 0 END),0) AS fat_ano_ant,
        ISNULL(SUM(CASE WHEN nf.dt_emi_nf >= ${monthStart} AND nf.dt_emi_nf < ${monthEnd} THEN nf.vl_faturamento ELSE 0 END),0) AS fat_mes,
        ISNULL(SUM(CASE WHEN nf.dt_emi_nf >= ${lastMonthStart} AND nf.dt_emi_nf < ${lastMonthEnd} THEN nf.vl_faturamento ELSE 0 END),0) AS fat_mes_ant,
        COUNT(CASE WHEN nf.dt_emi_nf >= ${yearStart} AND nf.dt_emi_nf < ${yearEnd} THEN 1 END) AS nfs_ano,
        COUNT(CASE WHEN nf.dt_emi_nf >= ${monthStart} AND nf.dt_emi_nf < ${monthEnd} THEN 1 END) AS nfs_mes,
        COUNT(DISTINCT CASE WHEN nf.dt_emi_nf >= ${yearStart} AND nf.dt_emi_nf < ${yearEnd} THEN nf.cd_pessoa END) AS clientes_ano,
        COUNT(DISTINCT CASE WHEN nf.dt_emi_nf >= ${monthStart} AND nf.dt_emi_nf < ${monthEnd} THEN nf.cd_pessoa END) AS clientes_mes
      FROM nf WITH (NOLOCK)
      WHERE nf.dt_emi_nf >= ${lastYearStart} AND nf.dt_emi_nf < ${yearEnd} ${cancelFilter}
      GROUP BY nf.cd_empresa`;
      const empKpiRes = await runQuery(source, wrap(empKpiSql), 30000);
      queryCount++;
      const empKpiRows = getRows(empKpiRes);

      let empNames = {};
      try {
        const empNameRes = await runQuery(source, wrap('SELECT cd_empresa, nm_fan_empresa FROM empresa WHERE cd_empresa <= 50'));
        queryCount++;
        for (const r of getRows(empNameRes)) {
          empNames[Number(r.cd_empresa)] = String(r.nm_fan_empresa || '');
        }
      } catch {
        warnings.push('Falha ao extrair nomes de empresas.');
      }

      byEmpresa = empKpiRows.map(r => {
        const fatAno = Number(r.fat_ano) || 0;
        const fatAnoAnt = Number(r.fat_ano_ant) || 0;
        const fatMes = Number(r.fat_mes) || 0;
        const fatMesAnt = Number(r.fat_mes_ant) || 0;
        const nfsAno = Number(r.nfs_ano) || 0;
        const nfsMes = Number(r.nfs_mes) || 0;
        const clientesAno = fichEmpClients[Number(r.cd_empresa)]?.ano || 0;
        return {
          cd_empresa: Number(r.cd_empresa),
          nm_empresa: empNames[Number(r.cd_empresa)] || `Empresa ${r.cd_empresa}`,
          fat_ano: fatAno,
          fat_ano_ant: fatAnoAnt,
          fat_mes: fatMes,
          fat_mes_ant: fatMesAnt,
          nfs_ano: nfsAno,
          nfs_mes: nfsMes,
          clientes_ano: clientesAno,
          clientes_mes: fichEmpClients[Number(r.cd_empresa)]?.mes || 0,
          ticket_ano: nfsAno > 0 ? fatAno / nfsAno : 0,
          ticket_mes: nfsMes > 0 ? fatMes / nfsMes : 0,
          crescimento_ano: fatAnoAnt > 0 ? ((fatAno - fatAnoAnt) / fatAnoAnt * 100) : null,
          crescimento_mes: fatMesAnt > 0 ? ((fatMes - fatMesAnt) / fatMesAnt * 100) : null,
          receita_por_cliente: clientesAno > 0 ? fatAno / clientesAno : 0,
        };
      }).sort((a, b) => b.fat_ano - a.fat_ano);
    } catch (e) {
      warnings.push('Falha ao extrair KPIs por empresa: ' + (e.message || String(e)).slice(0, 120));
    }
    await updateStep(8, 84);

    // Etapa 10: Calcular KPIs derivados
    const kpis = {
      fat_ano: Number(kpiRow.fat_ano) || 0,
      fat_ano_ant: Number(kpiRow.fat_ano_ant) || 0,
      fat_mes: Number(kpiRow.fat_mes) || 0,
      fat_mes_ant: Number(kpiRow.fat_mes_ant) || 0,
      nfs_mes: Number(kpiRow.nfs_mes) || 0,
      nfs_ano: Number(kpiRow.nfs_ano) || 0,
      clientes_mes: fichClients.mes,
      clientes_ano: fichClients.ano,
      ticket_ano: Number(kpiRow.ticket_ano) || 0,
      ticket_mes: Number(kpiRow.ticket_mes) || 0,
      crescimento_ano: Number(kpiRow.fat_ano_ant) > 0 ? ((Number(kpiRow.fat_ano) - Number(kpiRow.fat_ano_ant)) / Number(kpiRow.fat_ano_ant) * 100) : null,
      crescimento_mes: Number(kpiRow.fat_mes_ant) > 0 ? ((Number(kpiRow.fat_mes) - Number(kpiRow.fat_mes_ant)) / Number(kpiRow.fat_mes_ant) * 100) : null,
    };
    const top10Total = topClients.slice(0, 10).reduce((s, c) => s + c.total, 0);
    kpis.concentracao_top10 = kpis.fat_ano > 0 ? (top10Total / kpis.fat_ano * 100) : 0;
    kpis.retained_clients = cohortKpis.retained_clients || 0;
    kpis.new_clients = cohortKpis.new_clients || 0;
    kpis.churned_clients = cohortKpis.churned_clients || 0;
    kpis.clients_last_year = cohortKpis.clients_last_year || 0;
    kpis.retention_rate = cohortKpis.retention_rate;
    kpis.churn_rate = cohortKpis.churn_rate;
    kpis.new_client_revenue = cohortKpis.new_client_revenue || 0;
    kpis.retained_revenue = cohortKpis.retained_revenue || 0;
    kpis.receita_por_cliente = kpis.clientes_ano > 0 ? (kpis.fat_ano / kpis.clientes_ano) : 0;
    kpis.fat_ponderado = kpis.fat_mes * 0.6;

    // Gerar alertas automáticos
    const alerts = generateAlerts(kpis, topClients);
    await updateStep(9, 88);

    // Etapa: Validar
    const maxDate = kpiRow.max_date;
    const maxDateStr = maxDate ? new Date(maxDate).toISOString().slice(0, 10) : null;
    const totalRecords = kpis.clientes_ano + kpis.nfs_ano;
    await updateStep(10, 92);

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
      revenue_by_state: revenueByState,
      new_clients_monthly: newClientsMonthly,
      alerts,
      by_empresa: byEmpresa,
      clients_total: kpis.clientes_ano,
      query_count: queryCount,
      duration_ms: Date.now() - startTime,
    });

    // Etapa 12: Publicar — desmarcar anterior, marcar nova
    await updateStep(11, 95);
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
    return { status: warnings.length > 0 ? 'partial' : 'success' };
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
    return { status: 'failed', error: err.message || String(err) };
  }
}