import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { buildConfig, runQuery } from '../../shared/erpConnection.ts';
import { approvedRemessaFrom, faturaFrom } from '../../shared/churnUniverse.ts';
import { computeAnalytics } from '../../shared/analyticsBlock.ts';
import { empFilter, EXCLUDED_EMPRESAS } from '../../shared/empresaScope.ts';
import { invoiceUniverse } from '../../shared/invoiceUniverse.ts';
import { assertIsoDate } from '../../shared/periodContract.ts';

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
    const result = await processRefresh(base44, source, run, version, previousVersion, body?.start_date, body?.end_date_exclusive || body?.end_date);

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

async function processRefresh(base44, source, run, version, previousVersion, startDateIn, endDateIn) {
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

    // Empresas fora de escopo (LLK RENTAL, JCK) — excluídas de todas as consultas
    const empF = empFilter();
    const empFn = empFilter('n');
    const empFnf = empFilter('nf');
    const wrap = (inner) => config.clientId
      ? `EXEC DW_API '${config.clientId}', '${inner.replace(/'/g, "''")}'`
      : inner;

    // Etapa 1: Conectar
    await runQuery(source, wrap('SELECT 1 AS ok'));
    queryCount++;
    await updateStep(1, 10);

    // Etapa 2: universo fiscal canônico compartilhado.
    // CAST torna fl_can_nf robusto aos formatos S/N e 0/1 sem alterar a semântica.
    const nfF = `AND ${invoiceUniverse()}`;
    const nfFn = `AND ${invoiceUniverse('n')}`;
    const nfFnf = `AND ${invoiceUniverse('nf')}`;
    await updateStep(2, 15);

    // Fragmentos de data. Se o usuário atualizou com um período explícito, TODOS os
    // KPIs principais do snapshot usam exatamente essa janela; sem período, preservamos
    // o comportamento padrão do ano corrente/YTD.
    if ((startDateIn && !endDateIn) || (!startDateIn && endDateIn)) {
      throw new Error('Período de atualização incompleto: informe início e fim exclusivo.');
    }
    const requestedStart = startDateIn ? assertIsoDate(String(startDateIn), 'start_date') : null;
    const requestedEnd = endDateIn ? assertIsoDate(String(endDateIn), 'end_date_exclusive') : null;
    if (requestedStart && requestedEnd && requestedEnd <= requestedStart) {
      throw new Error('Período de atualização inválido: fim deve ser posterior ao início.');
    }
    const yearStart = requestedStart ? `'${requestedStart}'` : 'DATEFROMPARTS(YEAR(GETDATE()),1,1)';
    const yearEnd = requestedEnd ? `'${requestedEnd}'` : 'DATEADD(year,1,DATEFROMPARTS(YEAR(GETDATE()),1,1))';
    const lastYearStart = requestedStart ? `DATEADD(year,-1,CAST('${requestedStart}' AS date))` : 'DATEFROMPARTS(YEAR(GETDATE())-1,1,1)';
    const monthStart = 'DATEFROMPARTS(YEAR(GETDATE()),MONTH(GETDATE()),1)';
    const monthEnd = 'DATEADD(month,1,DATEFROMPARTS(YEAR(GETDATE()),MONTH(GETDATE()),1))';
    const prevMonthStart = 'DATEADD(month,-1,DATEFROMPARTS(YEAR(GETDATE()),MONTH(GETDATE()),1))';
    // Comparação anual: mesma janela deslocada em 1 ano quando há período explícito.
    const lastYearEnd = requestedEnd ? `DATEADD(year,-1,CAST('${requestedEnd}' AS date))` : 'DATEADD(year,-1,GETDATE())';
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
      FROM nf WHERE dt_emi_nf >= ${lastYearStart} AND dt_emi_nf < ${yearEnd} ${nfF} ${empF}`;

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
          AND cd_pessoa IS NOT NULL AND cd_pessoa <> '' ${empF}
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
          AND cd_pessoa IS NOT NULL AND cd_pessoa <> '' ${empF}`;
      const gRes = await runQuery(source, wrap(gSql), 30000);
      queryCount++;
      const gRow = getRows(gRes)[0] || {};
      fichClients = { ano: Number(gRow.clientes_ano) || 0, mes: Number(gRow.clientes_mes) || 0 };
    } catch (e) { warnings.push('Falha ao extrair clientes fich_loc: ' + (e.message || String(e)).slice(0, 120)); }
    await updateStep(4, 35);

    // Etapa 4: TODOS os clientes com receita no período (não apenas os 100 maiores) —
    // teto técnico de 5000 linhas para proteger o tamanho do snapshot.
    let topClients = [];
    try {
      const topClientsSql = `SELECT TOP 5000 cd_pessoa, ISNULL(SUM(vl_faturamento),0) AS total, COUNT(*) AS nfs, MAX(dt_emi_nf) AS ultima_nf
        FROM nf WHERE dt_emi_nf >= ${yearStart} AND dt_emi_nf < ${yearEnd} ${nfF} ${empF}
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
    // Top clientes por empresa (top 15 de cada) — para visão filtrada por empresa
    let topClientsByEmpresa = [];
    try {
      const tceSql = `SELECT cd_empresa, cd_pessoa, total, nfs, ultima_nf FROM (
        SELECT cd_empresa, cd_pessoa, ISNULL(SUM(vl_faturamento),0) AS total, COUNT(*) AS nfs, MAX(dt_emi_nf) AS ultima_nf,
          ROW_NUMBER() OVER (PARTITION BY cd_empresa ORDER BY ISNULL(SUM(vl_faturamento),0) DESC) AS rn
        FROM nf WITH (NOLOCK)
        WHERE dt_emi_nf >= ${yearStart} AND dt_emi_nf < ${yearEnd} ${nfF} ${empF}
        GROUP BY cd_empresa, cd_pessoa
      ) x WHERE rn <= 1000 ORDER BY cd_empresa, rn`;
      const tceRes = await runQuery(source, wrap(tceSql), 30000);
      queryCount++;
      topClientsByEmpresa = getRows(tceRes).map(r => ({
        cd_empresa: Number(r.cd_empresa),
        cd_pessoa: String(r.cd_pessoa || ''),
        total: Number(r.total) || 0,
        nfs: Number(r.nfs) || 0,
        ultima_nf: r.ultima_nf ? new Date(r.ultima_nf).toISOString().slice(0, 10) : null
      }));
    } catch (e) {
      warnings.push('Falha ao extrair top clientes por empresa: ' + (e.message || String(e)).slice(0, 120));
    }
    await updateStep(5, 50);

    // Etapa 5: Top 15 vendedores — via relação de comissão (financas_car_comissao.cd_nf = nf.cd_nf).
    // nf.cd_pessoa_fun é apenas o funcionário que emitiu a NF (back-office); o vendedor real
    // (quem fechou a venda) está vinculado à NF pela tabela de comissão. Uma NF pode ter 1-3
    // vendedores, então somamos vl_base_comissao por vendedor (atribuição já rateada).
    let topVendors = [];
    try {
      const topVendorsSql = `SELECT TOP 15 c.cd_pessoa,
          COALESCE(NULLIF(p.nm_fan_pessoa,''), p.nm_pessoa) AS nm_pessoa,
          ISNULL(SUM(c.vl_base_comissao),0) AS total,
          COUNT(DISTINCT c.cd_nf) AS nfs
        FROM financas_car_comissao c WITH (NOLOCK)
        JOIN nf n WITH (NOLOCK) ON n.cd_nf = c.cd_nf
        JOIN pessoa p WITH (NOLOCK) ON p.cd_pessoa = c.cd_pessoa
        WHERE n.dt_emi_nf >= ${yearStart} AND n.dt_emi_nf < ${yearEnd} ${nfFn} ${empFn}
          AND c.cd_pessoa IS NOT NULL
        GROUP BY c.cd_pessoa, p.nm_fan_pessoa, p.nm_pessoa
        ORDER BY ISNULL(SUM(c.vl_base_comissao),0) DESC`;
      const tvRes = await runQuery(source, wrap(topVendorsSql), 30000);
      queryCount++;
      topVendors = getRows(tvRes).map(r => ({
        cd_pessoa_fun: Number(r.cd_pessoa) || 0,
        nm_pessoa: String(r.nm_pessoa || ''),
        total: Number(r.total) || 0,
        nfs: Number(r.nfs) || 0
      }));
    } catch (e) {
      warnings.push('Falha ao extrair top vendedores: ' + (e.message || String(e)).slice(0, 120));
    }
    // Top vendedores por empresa (top 15 de cada) — para visão filtrada por empresa
    let topVendorsByEmpresa = [];
    try {
      const tveSql = `SELECT cd_empresa, cd_pessoa, nm_pessoa, total, nfs FROM (
        SELECT n.cd_empresa, c.cd_pessoa,
          COALESCE(NULLIF(p.nm_fan_pessoa,''), p.nm_pessoa) AS nm_pessoa,
          ISNULL(SUM(c.vl_base_comissao),0) AS total,
          COUNT(DISTINCT c.cd_nf) AS nfs,
          ROW_NUMBER() OVER (PARTITION BY n.cd_empresa ORDER BY ISNULL(SUM(c.vl_base_comissao),0) DESC) AS rn
        FROM financas_car_comissao c WITH (NOLOCK)
        JOIN nf n WITH (NOLOCK) ON n.cd_nf = c.cd_nf
        JOIN pessoa p WITH (NOLOCK) ON p.cd_pessoa = c.cd_pessoa
        WHERE n.dt_emi_nf >= ${yearStart} AND n.dt_emi_nf < ${yearEnd} ${nfFn} ${empFn}
          AND c.cd_pessoa IS NOT NULL
        GROUP BY n.cd_empresa, c.cd_pessoa, p.nm_fan_pessoa, p.nm_pessoa
      ) x WHERE rn <= 15 ORDER BY cd_empresa, rn`;
      const tveRes = await runQuery(source, wrap(tveSql), 30000);
      queryCount++;
      topVendorsByEmpresa = getRows(tveRes).map(r => ({
        cd_empresa: Number(r.cd_empresa),
        cd_pessoa_fun: Number(r.cd_pessoa) || 0,
        nm_pessoa: String(r.nm_pessoa || ''),
        total: Number(r.total) || 0,
        nfs: Number(r.nfs) || 0
      }));
    } catch (e) {
      warnings.push('Falha ao extrair top vendedores por empresa: ' + (e.message || String(e)).slice(0, 120));
    }

    // Etapa 5b: Resolução de nomes dos clientes (vendedores já vêm com nome da tabela de comissão)
    try {
      const codes = [...new Set([...topClients, ...topClientsByEmpresa].map(c => Number(c.cd_pessoa)))].filter(Boolean);
      const nameMap = {};
      for (let i = 0; i < codes.length; i += 200) {
        const batch = codes.slice(i, i + 200);
        try {
          const namesSql = `SELECT cd_pessoa, COALESCE(NULLIF(nm_fan_pessoa,''), nm_pessoa) AS nome FROM pessoa WITH (NOLOCK) WHERE cd_pessoa IN (${batch.join(',')})`;
          for (const r of getRows(await runQuery(source, wrap(namesSql)))) {
            nameMap[Number(r.cd_pessoa)] = String(r.nome || '');
          }
          queryCount++;
        } catch {}
      }
      topClients = topClients.map(c => ({
        ...c,
        nm_pessoa: nameMap[Number(c.cd_pessoa)] || `Cliente ${c.cd_pessoa}`,
      }));
      topClientsByEmpresa = topClientsByEmpresa.map(c => ({
        ...c,
        nm_pessoa: nameMap[Number(c.cd_pessoa)] || `Cliente ${c.cd_pessoa}`,
      }));
    } catch (e) {
      warnings.push('Falha ao resolver nomes: ' + (e.message || String(e)).slice(0, 120));
    }
    await updateStep(6, 65);

    // Etapa 6: Série mensal (36 meses) — cobre filtros que começam em anos anteriores
    let monthlyRevenue = [];
    try {
      const monthlySql = `SELECT cd_empresa, YEAR(dt_emi_nf) AS ano, MONTH(dt_emi_nf) AS mes, ISNULL(SUM(vl_faturamento),0) AS valor, COUNT(*) AS nfs, COUNT(DISTINCT cd_pessoa) AS clientes
        FROM nf WHERE dt_emi_nf >= DATEADD(month,-36,${monthStart}) /* janela longa */ AND dt_emi_nf < ${monthEnd} ${nfF} ${empF}
        GROUP BY cd_empresa, YEAR(dt_emi_nf), MONTH(dt_emi_nf) ORDER BY 1, 2, 3`;
      const monthlyRes = await runQuery(source, wrap(monthlySql), 30000);
      queryCount++;
      monthlyRevenue = getRows(monthlyRes).map(r => ({
        cd_empresa: Number(r.cd_empresa),
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

    // Etapa 7: Coorte de clientes — MESMO universo de "clientes ativos" (tabela nf),
    // comparando janelas equivalentes (jan→hoje deste ano vs. jan→hoje do ano anterior).
    // Garante novos + recorrentes = clientes_ano e churn sem distorção de sazonalidade.
    let cohortKpis = {};
    let cohortByEmpresa = {};
    try {
      // Duas consultas sargáveis sobre nf — mesma origem dos KPIs de clientes ativos.
      const lastYrSql = `SELECT DISTINCT cd_empresa, cd_pessoa FROM nf WITH (NOLOCK)
        WHERE dt_emi_nf >= ${lastYearStart} AND dt_emi_nf < ${lastYearEnd} ${nfF} ${empF}
          AND cd_pessoa IS NOT NULL`;
      const thisYrSql = `SELECT DISTINCT cd_empresa, cd_pessoa FROM nf WITH (NOLOCK)
        WHERE dt_emi_nf >= ${yearStart} AND dt_emi_nf < ${yearEnd} ${nfF} ${empF}
          AND cd_pessoa IS NOT NULL`;
      const lastRows = getRows(await runQuery(source, wrap(lastYrSql), 30000));
      queryCount++;
      const thisRows = getRows(await runQuery(source, wrap(thisYrSql), 30000));
      queryCount++;
      const lastSet = new Set(lastRows.map(r => `${Number(r.cd_empresa)}|${String(r.cd_pessoa)}`));
      const thisSet = new Set(thisRows.map(r => `${Number(r.cd_empresa)}|${String(r.cd_pessoa)}`));
      // Consolidado (dedupe por cd_pessoa entre empresas) + agregação por empresa
      const consolidated = {};
      for (const key of new Set([...lastSet, ...thisSet])) {
        const sep = key.indexOf('|');
        const emp = Number(key.slice(0, sep));
        const code = key.slice(sep + 1);
        const ly = lastSet.has(key) ? 1 : 0;
        const ty = thisSet.has(key) ? 1 : 0;
        if (!cohortByEmpresa[emp]) cohortByEmpresa[emp] = { retained: 0, newC: 0, churned: 0, clientsLastYear: 0, newSet: new Set(), retainedSet: new Set() };
        const ce = cohortByEmpresa[emp];
        if (ly === 1) ce.clientsLastYear++;
        if (ly === 1 && ty === 1) { ce.retained++; ce.retainedSet.add(code); }
        if (ty === 1 && ly === 0) { ce.newC++; ce.newSet.add(code); }
        if (ly === 1 && ty === 0) ce.churned++;
        if (!consolidated[code]) consolidated[code] = { ly: 0, ty: 0 };
        consolidated[code].ly = Math.max(consolidated[code].ly, ly);
        consolidated[code].ty = Math.max(consolidated[code].ty, ty);
      }
      let retained = 0, newC = 0, churned = 0, clientsLastYear = 0;
      const newSet = new Set(), retainedSet = new Set();
      for (const [code, v] of Object.entries(consolidated)) {
        if (v.ly === 1) clientsLastYear++;
        if (v.ly === 1 && v.ty === 1) { retained++; retainedSet.add(code); }
        if (v.ty === 1 && v.ly === 0) { newC++; newSet.add(code); }
        if (v.ly === 1 && v.ty === 0) churned++;
      }
      // Receita do ano (fl_fatura) por (empresa, cliente) — atribui ao coorte consolidado e por empresa
      let newRevenue = 0, retainedRevenue = 0;
      const perEmpRev = {};
      try {
        const revSql = `SELECT cd_empresa, cd_pessoa, ISNULL(SUM(vl_faturamento),0) AS rev
          FROM nf WITH (NOLOCK)
          WHERE dt_emi_nf >= ${yearStart} AND dt_emi_nf < ${yearEnd} ${nfF} ${empF}
            AND cd_pessoa IS NOT NULL
          GROUP BY cd_empresa, cd_pessoa`;
        for (const r of getRows(await runQuery(source, wrap(revSql), 30000))) {
          const emp = Number(r.cd_empresa);
          const code = String(r.cd_pessoa);
          const v = Number(r.rev) || 0;
          if (retainedSet.has(code)) retainedRevenue += v;
          else if (newSet.has(code)) newRevenue += v;
          if (cohortByEmpresa[emp]) {
            if (!perEmpRev[emp]) perEmpRev[emp] = { newRev: 0, retainedRev: 0 };
            if (cohortByEmpresa[emp].retainedSet.has(code)) perEmpRev[emp].retainedRev += v;
            else if (cohortByEmpresa[emp].newSet.has(code)) perEmpRev[emp].newRev += v;
          }
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
      for (const [emp, ce] of Object.entries(cohortByEmpresa)) {
        ce.retention_rate = ce.clientsLastYear > 0 ? (ce.retained / ce.clientsLastYear * 100) : null;
        ce.churn_rate = ce.clientsLastYear > 0 ? (ce.churned / ce.clientsLastYear * 100) : null;
        ce.new_client_revenue = perEmpRev[emp]?.newRev || 0;
        ce.retained_revenue = perEmpRev[emp]?.retainedRev || 0;
      }
    } catch (e) {
      warnings.push('Falha ao extrair coorte de clientes: ' + (e.message || String(e)).slice(0, 120));
    }
    await updateStep(7, 72);

    // Etapa 7b: Churn/retenção em janela móvel de 12 meses, ponderado por receita.
    //
    // Falhas da métrica anterior (coorte por ano civil), corrigidas aqui:
    //  (a) janela YTD: em agosto, quem comprou em out/2025 (há 10 meses) era contado como
    //      churn embora esteja ativo no ciclo de 12 meses — inflava o churn;
    //  (b) contagem por cabeça: a cauda longa de clientes pequenos/pontuais dominava o
    //      percentual, escondendo que a receita vem da base recorrente;
    //  (c) nenhuma leitura de receita em risco — churn de cliente ≠ churn de receita.
    // Aqui: base = clientes com NF nos 12 meses anteriores; churn = os que não emitiram
    // NF nos 12 meses correntes. Uma única consulta traz receita das duas janelas.
    let churn12 = null;
    let churn12ByEmpresa = [];
    try {
      const curStart = 'DATEADD(year,-1,GETDATE())';
      const prevStart = 'DATEADD(year,-2,GETDATE())';
      // Grão (empresa, cliente): permite churn por filial e, com dedupe por cd_pessoa,
      // o consolidado do grupo (um cliente atendido por 2 filiais conta uma vez no geral).
      const c12Sql = `SELECT cd_empresa, cd_pessoa,
          ISNULL(SUM(CASE WHEN dt_emi_nf >= ${prevStart} AND dt_emi_nf < ${curStart} THEN vl_faturamento ELSE 0 END),0) AS rev_prev,
          COUNT(CASE WHEN dt_emi_nf >= ${prevStart} AND dt_emi_nf < ${curStart} THEN 1 END) AS nfs_prev,
          ISNULL(SUM(CASE WHEN dt_emi_nf >= ${curStart} THEN vl_faturamento ELSE 0 END),0) AS rev_cur,
          COUNT(CASE WHEN dt_emi_nf >= ${curStart} THEN 1 END) AS nfs_cur
        FROM nf WITH (NOLOCK)
        WHERE dt_emi_nf >= ${prevStart} AND dt_emi_nf < GETDATE() ${nfF} ${empF}
          AND cd_pessoa IS NOT NULL
        GROUP BY cd_empresa, cd_pessoa`;
      const c12Rows = getRows(await runQuery(source, wrap(c12Sql), 30000));
      queryCount++;

      // Acumulador reutilizado para consolidado e para cada empresa
      const newAcc = () => ({
        base: 0, retained: 0, churned: 0, novos: 0,
        baseRev: 0, churnedRev: 0, retainedRevCur: 0, novosRevCur: 0, curRev: 0,
      });
      const addTo = (a, nfsPrev, nfsCur, revPrev, revCur) => {
        a.curRev += revCur;
        if (nfsPrev > 0) { a.base++; a.baseRev += revPrev; }
        if (nfsPrev > 0 && nfsCur > 0) { a.retained++; a.retainedRevCur += revCur; }
        if (nfsPrev > 0 && nfsCur === 0) { a.churned++; a.churnedRev += revPrev; }
        if (nfsPrev === 0 && nfsCur > 0) { a.novos++; a.novosRevCur += revCur; }
      };
      const finish = (a) => ({
        base_clients: a.base,
        active_clients: a.retained + a.novos,
        retained_clients: a.retained,
        churned_clients: a.churned,
        new_clients: a.novos,
        churn_rate: a.base > 0 ? (a.churned / a.base * 100) : null,
        retention_rate: a.base > 0 ? (a.retained / a.base * 100) : null,
        revenue_churn_rate: a.baseRev > 0 ? (a.churnedRev / a.baseRev * 100) : null,
        revenue_at_risk: a.churnedRev,
        base_revenue: a.baseRev,
        current_revenue: a.curRev,
        retained_revenue: a.retainedRevCur,
        new_revenue: a.novosRevCur,
        retained_revenue_share: a.curRev > 0 ? (a.retainedRevCur / a.curRev * 100) : null,
        new_revenue_share: a.curRev > 0 ? (a.novosRevCur / a.curRev * 100) : null,
      });

      const perEmp = {};
      const consol = {}; // cd_pessoa -> somas entre empresas (dedupe do grupo)
      for (const r of c12Rows) {
        const emp = Number(r.cd_empresa);
        const code = String(r.cd_pessoa);
        const nfsPrev = Number(r.nfs_prev) || 0;
        const nfsCur = Number(r.nfs_cur) || 0;
        const revPrev = Number(r.rev_prev) || 0;
        const revCur = Number(r.rev_cur) || 0;
        if (!perEmp[emp]) perEmp[emp] = newAcc();
        addTo(perEmp[emp], nfsPrev, nfsCur, revPrev, revCur);
        if (!consol[code]) consol[code] = { nfsPrev: 0, nfsCur: 0, revPrev: 0, revCur: 0 };
        consol[code].nfsPrev += nfsPrev;
        consol[code].nfsCur += nfsCur;
        consol[code].revPrev += revPrev;
        consol[code].revCur += revCur;
      }
      const total = newAcc();
      for (const v of Object.values(consol)) addTo(total, v.nfsPrev, v.nfsCur, v.revPrev, v.revCur);
      const { base, retained, churned, novos, baseRev, churnedRev, retainedRevCur, novosRevCur, curRev } = total;

      churn12ByEmpresa = Object.entries(perEmp)
        .map(([emp, a]) => ({ cd_empresa: Number(emp), ...finish(a) }))
        .sort((a, b) => b.current_revenue - a.current_revenue);

      churn12 = {
        base_clients: base,
        active_clients: retained + novos,
        retained_clients: retained,
        churned_clients: churned,
        new_clients: novos,
        churn_rate: base > 0 ? (churned / base * 100) : null,
        retention_rate: base > 0 ? (retained / base * 100) : null,
        revenue_churn_rate: baseRev > 0 ? (churnedRev / baseRev * 100) : null,
        revenue_at_risk: churnedRev,
        base_revenue: baseRev,
        current_revenue: curRev,
        retained_revenue: retainedRevCur,
        new_revenue: novosRevCur,
        retained_revenue_share: curRev > 0 ? (retainedRevCur / curRev * 100) : null,
        new_revenue_share: curRev > 0 ? (novosRevCur / curRev * 100) : null,
      };
    } catch (e) {
      warnings.push('Falha ao calcular churn 12 meses: ' + (e.message || String(e)).slice(0, 120));
    }

    // Etapa 8: Novos clientes por mês (primeira locação — fich_loc)
    let newClientsMonthly = [];
    try {
      const ncmSql = `SELECT YEAR(first_ficha) AS ano, MONTH(first_ficha) AS mes, COUNT(*) AS new_clients
        FROM (
          SELECT cd_pessoa, MIN(dt_pedido) AS first_ficha
          FROM fich_loc WITH (NOLOCK)
          WHERE dt_pedido >= ${lastYearStart} AND dt_pedido < ${yearEnd}
            AND cd_pessoa IS NOT NULL AND cd_pessoa <> '' ${empF}
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
        WHERE dt_emi_nf >= ${yearStart} AND dt_emi_nf < ${yearEnd} ${nfF} ${empF}
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
      WHERE nf.dt_emi_nf >= ${lastYearStart} AND nf.dt_emi_nf < ${yearEnd} ${nfFnf} ${empFnf}
      GROUP BY nf.cd_empresa`;
      const empKpiRes = await runQuery(source, wrap(empKpiSql), 30000);
      queryCount++;
      const empKpiRows = getRows(empKpiRes);

      let empNames = {};
      try {
        const empNameRes = await runQuery(source, wrap(`SELECT cd_empresa, nm_fan_empresa FROM empresa WHERE cd_empresa <= 50 AND cd_empresa NOT IN (${EXCLUDED_EMPRESAS.join(',')})`));
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
        const clientesAno = Number(r.clientes_ano) || 0;
        const ce = cohortByEmpresa[Number(r.cd_empresa)];
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
          clientes_mes: Number(r.clientes_mes) || 0,
          ticket_ano: nfsAno > 0 ? fatAno / nfsAno : 0,
          ticket_mes: nfsMes > 0 ? fatMes / nfsMes : 0,
          crescimento_ano: fatAnoAnt > 0 ? ((fatAno - fatAnoAnt) / fatAnoAnt * 100) : null,
          crescimento_mes: fatMesAnt > 0 ? ((fatMes - fatMesAnt) / fatMesAnt * 100) : null,
          receita_por_cliente: clientesAno > 0 ? fatAno / clientesAno : 0,
          retained_clients: ce?.retained || 0,
          new_clients: ce?.newC || 0,
          churned_clients: ce?.churned || 0,
          clients_last_year: ce?.clientsLastYear || 0,
          retention_rate: ce?.retention_rate ?? null,
          churn_rate: ce?.churn_rate ?? null,
          new_client_revenue: ce?.new_client_revenue || 0,
          retained_revenue: ce?.retained_revenue || 0,
        };
      }).sort((a, b) => b.fat_ano - a.fat_ano);
    } catch (e) {
      warnings.push('Falha ao extrair KPIs por empresa: ' + (e.message || String(e)).slice(0, 120));
    }
    await updateStep(8, 84);

    // Etapa: Evolução anual (últimos 5 anos) — faturamento, novos clientes e
    // decomposição da receita entre clientes novos (1ª NF no ano) e clientes da base.
    // Janela de 6 anos extraída; o ano mais antigo serve apenas de lookback e é descartado.
    const evoStart = 'DATEFROMPARTS(YEAR(GETDATE())-5,1,1)';
    const mapEvoRow = (r) => ({
      ...(r.cd_empresa != null ? { cd_empresa: Number(r.cd_empresa) } : {}),
      ano: Number(r.ano),
      fat_total: Number(r.fat_total) || 0,
      clientes: Number(r.clientes) || 0,
      clientes_novos: Number(r.clientes_novos) || 0,
      fat_novos: Number(r.fat_novos) || 0,
      fat_base: Number(r.fat_base) || 0,
    });
    let annualEvolution = [];
    let annualEvolutionByEmpresa = [];
    try {
      const evoSql = `SELECT y.ano,
          ISNULL(SUM(y.fat),0) AS fat_total,
          COUNT(DISTINCT y.cd_pessoa) AS clientes,
          ISNULL(SUM(CASE WHEN y.ano = f.first_ano THEN y.fat ELSE 0 END),0) AS fat_novos,
          ISNULL(SUM(CASE WHEN y.ano > f.first_ano THEN y.fat ELSE 0 END),0) AS fat_base,
          COUNT(DISTINCT CASE WHEN y.ano = f.first_ano THEN y.cd_pessoa END) AS clientes_novos
        FROM (
          SELECT cd_pessoa, YEAR(dt_emi_nf) AS ano, ISNULL(SUM(vl_faturamento),0) AS fat
          FROM nf WITH (NOLOCK)
          WHERE dt_emi_nf >= ${evoStart} AND dt_emi_nf < ${yearEnd} ${nfF} ${empF}
          GROUP BY cd_pessoa, YEAR(dt_emi_nf)
        ) y
        JOIN (
          SELECT cd_pessoa, MIN(YEAR(dt_emi_nf)) AS first_ano
          FROM nf WITH (NOLOCK)
          WHERE dt_emi_nf >= ${evoStart} AND dt_emi_nf < ${yearEnd} ${nfF} ${empF}
          GROUP BY cd_pessoa
        ) f ON f.cd_pessoa = y.cd_pessoa
        GROUP BY y.ano ORDER BY y.ano`;
      const rows = getRows(await runQuery(source, wrap(evoSql), 30000)).map(mapEvoRow);
      queryCount++;
      if (rows.length > 0) {
        const minYear = Math.min(...rows.map(r => r.ano));
        annualEvolution = rows.filter(r => r.ano > minYear);
      }
    } catch (e) {
      warnings.push('Falha ao extrair evolução anual: ' + (e.message || String(e)).slice(0, 120));
    }
    try {
      const evoEmpSql = `SELECT y.cd_empresa, y.ano,
          ISNULL(SUM(y.fat),0) AS fat_total,
          COUNT(DISTINCT y.cd_pessoa) AS clientes,
          ISNULL(SUM(CASE WHEN y.ano = f.first_ano THEN y.fat ELSE 0 END),0) AS fat_novos,
          ISNULL(SUM(CASE WHEN y.ano > f.first_ano THEN y.fat ELSE 0 END),0) AS fat_base,
          COUNT(DISTINCT CASE WHEN y.ano = f.first_ano THEN y.cd_pessoa END) AS clientes_novos
        FROM (
          SELECT cd_empresa, cd_pessoa, YEAR(dt_emi_nf) AS ano, ISNULL(SUM(vl_faturamento),0) AS fat
          FROM nf WITH (NOLOCK)
          WHERE dt_emi_nf >= ${evoStart} AND dt_emi_nf < ${yearEnd} ${nfF} ${empF}
          GROUP BY cd_empresa, cd_pessoa, YEAR(dt_emi_nf)
        ) y
        JOIN (
          SELECT cd_empresa, cd_pessoa, MIN(YEAR(dt_emi_nf)) AS first_ano
          FROM nf WITH (NOLOCK)
          WHERE dt_emi_nf >= ${evoStart} AND dt_emi_nf < ${yearEnd} ${nfF} ${empF}
          GROUP BY cd_empresa, cd_pessoa
        ) f ON f.cd_empresa = y.cd_empresa AND f.cd_pessoa = y.cd_pessoa
        GROUP BY y.cd_empresa, y.ano ORDER BY y.cd_empresa, y.ano`;
      const rows = getRows(await runQuery(source, wrap(evoEmpSql), 30000)).map(mapEvoRow);
      queryCount++;
      if (rows.length > 0) {
        const minYear = Math.min(...rows.map(r => r.ano));
        annualEvolutionByEmpresa = rows.filter(r => r.ano > minYear);
      }
    } catch (e) {
      warnings.push('Falha ao extrair evolução anual por empresa: ' + (e.message || String(e)).slice(0, 120));
    }
    await updateStep(8, 85);

    // Etapa: Analytics (CAR/CAP/Locações/Operacional) — bloco pré-calculado para as abas
    await updateStep(8, 86, { step_label: 'Extraindo analytics (CAR/CAP/Locações)' });
    let analytics = null;
    let analyticsPeriod = null;
    try {
      const aStart = startDateIn || `${new Date().getFullYear()}-01-01`;
      const aEnd = endDateIn || `${new Date().getFullYear() + 1}-01-01`;
      const aLastYearStart = `${Number(String(aStart).slice(0, 4)) - 1}${String(aStart).slice(4)}`;
      const aRes = await computeAnalytics({ source, wrap, startDate: aStart, endDate: aEnd, lastYearStart: aLastYearStart, runQuery, getRows });
      analytics = aRes.analytics;
      analyticsPeriod = { start: aStart, end: aEnd };
      for (const w of aRes.warnings) warnings.push(w);
      queryCount += aRes.queryCount || 0;
    } catch (e) {
      warnings.push('Falha ao extrair analytics: ' + (e.message || String(e)).slice(0, 120));
    }

    // Etapa 10: Calcular KPIs derivados
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
    kpis.retained_clients = cohortKpis.retained_clients || 0;
    kpis.new_clients = cohortKpis.new_clients || 0;
    kpis.churned_clients = cohortKpis.churned_clients || 0;
    kpis.clients_last_year = cohortKpis.clients_last_year || 0;
    kpis.retention_rate = cohortKpis.retention_rate;
    kpis.churn_rate = cohortKpis.churn_rate;
    kpis.new_client_revenue = cohortKpis.new_client_revenue || 0;
    kpis.retained_revenue = cohortKpis.retained_revenue || 0;
    kpis.churn12 = churn12;
    kpis.churn12_by_empresa = churn12ByEmpresa;
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
      top_clients_by_empresa: topClientsByEmpresa,
      top_vendors: topVendors,
      top_vendors_by_empresa: topVendorsByEmpresa,
      monthly_revenue: monthlyRevenue,
      revenue_by_state: revenueByState,
      new_clients_monthly: newClientsMonthly,
      annual_evolution: annualEvolution,
      annual_evolution_by_empresa: annualEvolutionByEmpresa,
      alerts,
      by_empresa: byEmpresa,
      analytics,
      analytics_period: analyticsPeriod,
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