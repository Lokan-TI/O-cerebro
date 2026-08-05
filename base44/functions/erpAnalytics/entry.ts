import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { buildConfig, runQuery } from '../../shared/erpConnection.ts';

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

const MES_PT = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
function fmtMonth(mes, ano) {
  return `${MES_PT[mes] || mes}/${String(ano).slice(2)}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const sourceId = body?.source_id;
    if (!sourceId) return Response.json({ success: false, error: 'source_id é obrigatório.' }, { status: 400 });

    const source = await base44.asServiceRole.entities.ErpDataSource.get(sourceId);
    if (!source) return Response.json({ success: false, error: 'Fonte de dados não encontrada.' }, { status: 404 });

    const config = buildConfig(source);
    if (!config) throw new Error('Configuração de conexão incompleta para a fonte.');

    const wrap = (inner) => config.clientId
      ? `EXEC DW_API '${config.clientId}', '${inner.replace(/'/g, "''")}'`
      : inner;

    const now = new Date();
    const year = body?.year || now.getFullYear();
    const startDate = body?.start_date || `${year}-01-01`;
    const endDate = body?.end_date || `${year + 1}-01-01`;
    const lastYearStart = `${year - 1}-01-01`;
    const cdEmpresa = body?.cd_empresa != null ? Number(body.cd_empresa) : null;
    const empCar = cdEmpresa != null ? ` AND cd_empresa_gestora = ${cdEmpresa}` : '';
    const empFich = cdEmpresa != null ? ` AND cd_empresa = ${cdEmpresa}` : '';
    const empFatGerada = cdEmpresa != null ? ` AND c.cd_empresa = ${cdEmpresa}` : '';
    const lastYearEnd = `${year}-01-01`;

    const out = {
      date_range: { start: startDate, end: endDate, year },
      car_by_empresa: [],
      cap_by_empresa: [],
      cap_by_conta: [],
      car_monthly: [],
      cap_monthly: [],
      car_vs_cap_monthly: [],
      fichloc_by_empresa: [],
      fichloc_monthly: [],
      fichloc_by_status: [],
      fichloc_top_clientes: [],
      receita_gerada_by_empresa: [],
      est_mov_by_operacao: [],
      est_mov_monthly: [],
      top_clients_car: [],
      plano_balancete: [],
      new_clients_monthly: [],
      pessoa_total: 0,
      fichloc_clientes_ativos: 0,
      empresas: [],
      kpis: {},
      errors: [],
    };

    // ── 1. Empresas ──
    try {
      const empSql = `SELECT cd_empresa, nm_fan_empresa, nm_razsoc_empresa FROM empresa WITH (NOLOCK) ORDER BY cd_empresa`;
      out.empresas = getRows(await runQuery(source, wrap(empSql))).map(r => ({
        cd_empresa: Number(r.cd_empresa),
        nm_fan_empresa: String(r.nm_fan_empresa || ''),
        nm_razsoc_empresa: String(r.nm_razsoc_empresa || ''),
      }));
    } catch (e) { out.errors.push('empresas: ' + (e.message || '').slice(0, 80)); }

    // ── 2. CAR por empresa (Contas a Receber) ──
    try {
      const carSql = `SELECT
        cd_empresa_gestora,
        COUNT(*) AS qtd,
        ISNULL(SUM(vl_pre_car),0) AS vl_total,
        ISNULL(SUM(CASE WHEN dt_bai_car IS NULL AND dt_cancelamento IS NULL THEN vl_pre_car ELSE 0 END),0) AS vl_aberto,
        ISNULL(SUM(CASE WHEN dt_bai_car IS NOT NULL THEN vl_pre_car ELSE 0 END),0) AS vl_baixado,
        ISNULL(SUM(CASE WHEN dt_ven_car < GETDATE() AND dt_bai_car IS NULL AND dt_cancelamento IS NULL THEN vl_pre_car ELSE 0 END),0) AS vl_vencido
        FROM car WITH (NOLOCK)
        WHERE dt_emi_car >= '${startDate}' AND dt_emi_car < '${endDate}' AND dt_cancelamento IS NULL${empCar}
        GROUP BY cd_empresa_gestora
        ORDER BY ISNULL(SUM(vl_pre_car),0) DESC`;
      out.car_by_empresa = getRows(await runQuery(source, wrap(carSql))).map(r => ({
        cd_empresa: Number(r.cd_empresa_gestora) || null,
        qtd: Number(r.qtd) || 0,
        vl_total: Number(r.vl_total) || 0,
        vl_aberto: Number(r.vl_aberto) || 0,
        vl_baixado: Number(r.vl_baixado) || 0,
        vl_vencido: Number(r.vl_vencido) || 0,
      }));
    } catch (e) { out.errors.push('car_by_empresa: ' + (e.message || '').slice(0, 80)); }

    // ── 3. CAP por conta (Contas a Pagar → Balancete) ──
    // tabela CAP não possui cd_empresa — query direta sem fallback
    try {
      const capSql = `SELECT
          cd_conta,
          COUNT(*) AS qtd,
          ISNULL(SUM(vl_pre_cap),0) AS vl_total,
          ISNULL(SUM(CASE WHEN dt_bai_cap IS NULL THEN vl_pre_cap ELSE 0 END),0) AS vl_aberto,
          ISNULL(SUM(CASE WHEN dt_bai_cap IS NOT NULL THEN vl_pre_cap ELSE 0 END),0) AS vl_baixado,
          ISNULL(SUM(CASE WHEN dt_ven_cap < GETDATE() AND dt_bai_cap IS NULL THEN vl_pre_cap ELSE 0 END),0) AS vl_vencido
          FROM cap WITH (NOLOCK)
          WHERE dt_emi_cap >= '${startDate}' AND dt_emi_cap < '${endDate}'
          GROUP BY cd_conta
          ORDER BY ISNULL(SUM(vl_pre_cap),0) DESC`;
      out.cap_by_conta = getRows(await runQuery(source, wrap(capSql))).map(r => ({
        cd_empresa: null,
        cd_conta: Number(r.cd_conta) || null,
        qtd: Number(r.qtd) || 0,
        vl_total: Number(r.vl_total) || 0,
        vl_aberto: Number(r.vl_aberto) || 0,
        vl_baixado: Number(r.vl_baixado) || 0,
        vl_vencido: Number(r.vl_vencido) || 0,
      }));
    } catch (e) { out.errors.push('cap_by_conta: ' + (e.message || '').slice(0, 80)); }

    // ── 4. CAR mensal (12 meses) ──
    try {
      const carMonSql = `SELECT YEAR(dt_emi_car) AS ano, MONTH(dt_emi_car) AS mes,
        ISNULL(SUM(vl_pre_car),0) AS vl_total,
        ISNULL(SUM(CASE WHEN dt_bai_car IS NULL AND dt_cancelamento IS NULL THEN vl_pre_car ELSE 0 END),0) AS vl_aberto,
        ISNULL(SUM(CASE WHEN dt_bai_car IS NOT NULL THEN vl_pre_car ELSE 0 END),0) AS vl_baixado,
        COUNT(*) AS qtd
        FROM car WITH (NOLOCK)
        WHERE dt_emi_car >= '${lastYearStart}' AND dt_emi_car < '${endDate}' AND dt_cancelamento IS NULL${empCar}
        GROUP BY YEAR(dt_emi_car), MONTH(dt_emi_car)
        ORDER BY 1, 2`;
      out.car_monthly = getRows(await runQuery(source, wrap(carMonSql))).map(r => ({
        ano: Number(r.ano), mes: Number(r.mes),
        vl_total: Number(r.vl_total) || 0,
        vl_aberto: Number(r.vl_aberto) || 0,
        vl_baixado: Number(r.vl_baixado) || 0,
        qtd: Number(r.qtd) || 0,
      }));
    } catch (e) { out.errors.push('car_monthly: ' + (e.message || '').slice(0, 80)); }

    // ── 5. CAP mensal (12 meses) ──
    try {
      const capMonSql = `SELECT YEAR(dt_emi_cap) AS ano, MONTH(dt_emi_cap) AS mes,
        ISNULL(SUM(vl_pre_cap),0) AS vl_total,
        ISNULL(SUM(CASE WHEN dt_bai_cap IS NULL THEN vl_pre_cap ELSE 0 END),0) AS vl_aberto,
        ISNULL(SUM(CASE WHEN dt_bai_cap IS NOT NULL THEN vl_pre_cap ELSE 0 END),0) AS vl_baixado,
        COUNT(*) AS qtd
        FROM cap WITH (NOLOCK)
        WHERE dt_emi_cap >= '${lastYearStart}' AND dt_emi_cap < '${endDate}'
        GROUP BY YEAR(dt_emi_cap), MONTH(dt_emi_cap)
        ORDER BY 1, 2`;
      out.cap_monthly = getRows(await runQuery(source, wrap(capMonSql))).map(r => ({
        ano: Number(r.ano), mes: Number(r.mes),
        vl_total: Number(r.vl_total) || 0,
        vl_aberto: Number(r.vl_aberto) || 0,
        vl_baixado: Number(r.vl_baixado) || 0,
        qtd: Number(r.qtd) || 0,
      }));
    } catch (e) { out.errors.push('cap_monthly: ' + (e.message || '').slice(0, 80)); }

    // ── 6. Fich_loc por empresa ──
    try {
      const fichSql = `SELECT
        cd_empresa,
        COUNT(*) AS qtd,
        ISNULL(SUM(CASE WHEN fl_baixada <> 'S' AND dt_enc_ficha IS NULL THEN 1 ELSE 0 END),0) AS qtd_ativas,
        ISNULL(SUM(CASE WHEN dt_enc_ficha IS NOT NULL THEN 1 ELSE 0 END),0) AS qtd_encerradas,
        ISNULL(SUM(vl_minimo_locacao),0) AS vl_minimo,
        ISNULL(SUM(vl_encerramento),0) AS vl_encerramento
        FROM fich_loc WITH (NOLOCK)
        WHERE dt_pedido >= '${startDate}' AND dt_pedido < '${endDate}'${empFich}
        GROUP BY cd_empresa
        ORDER BY COUNT(*) DESC`;
      out.fichloc_by_empresa = getRows(await runQuery(source, wrap(fichSql))).map(r => ({
        cd_empresa: Number(r.cd_empresa) || null,
        qtd: Number(r.qtd) || 0,
        qtd_ativas: Number(r.qtd_ativas) || 0,
        qtd_encerradas: Number(r.qtd_encerradas) || 0,
        vl_minimo: Number(r.vl_minimo) || 0,
        vl_encerramento: Number(r.vl_encerramento) || 0,
      }));
    } catch (e) { out.errors.push('fichloc_by_empresa: ' + (e.message || '').slice(0, 80)); }

    // ── 7. Fich_loc mensal ──
    try {
      const fichMonSql = `SELECT YEAR(dt_pedido) AS ano, MONTH(dt_pedido) AS mes,
        COUNT(*) AS qtd,
        ISNULL(SUM(CASE WHEN dt_enc_ficha IS NOT NULL THEN 1 ELSE 0 END),0) AS qtd_encerradas,
        ISNULL(SUM(vl_minimo_locacao),0) AS vl_minimo
        FROM fich_loc WITH (NOLOCK)
        WHERE dt_pedido >= '${lastYearStart}' AND dt_pedido < '${endDate}'${empFich}
        GROUP BY YEAR(dt_pedido), MONTH(dt_pedido)
        ORDER BY 1, 2`;
      out.fichloc_monthly = getRows(await runQuery(source, wrap(fichMonSql))).map(r => ({
        ano: Number(r.ano), mes: Number(r.mes),
        qtd: Number(r.qtd) || 0,
        qtd_encerradas: Number(r.qtd_encerradas) || 0,
        vl_minimo: Number(r.vl_minimo) || 0,
      }));
    } catch (e) { out.errors.push('fichloc_monthly: ' + (e.message || '').slice(0, 80)); }

    // ── 8. est_mov por operação ──
    try {
      const movSql = `SELECT m.cd_movoperacao, o.ds_movoperacao,
        COUNT(*) AS qtd,
        COUNT(DISTINCT m.cd_controle) AS qtd_controles
        FROM est_mov m WITH (NOLOCK)
        LEFT JOIN est_movoperacao o WITH (NOLOCK) ON m.cd_movoperacao = o.cd_movoperacao
        WHERE m.dt_geracao >= '${startDate}' AND m.dt_geracao < '${endDate}'
        GROUP BY m.cd_movoperacao, o.ds_movoperacao
        ORDER BY COUNT(*) DESC`;
      out.est_mov_by_operacao = getRows(await runQuery(source, wrap(movSql))).map(r => ({
        cd_movoperacao: Number(r.cd_movoperacao) || 0,
        ds_movoperacao: String(r.ds_movoperacao || `Op ${r.cd_movoperacao}`),
        qtd: Number(r.qtd) || 0,
        qtd_controles: Number(r.qtd_controles) || 0,
      }));
    } catch (e) { out.errors.push('est_mov_by_operacao: ' + (e.message || '').slice(0, 80)); }

    // ── 9. est_mov mensal ──
    try {
      const movMonSql = `SELECT YEAR(dt_geracao) AS ano, MONTH(dt_geracao) AS mes, COUNT(*) AS qtd
        FROM est_mov WITH (NOLOCK)
        WHERE dt_geracao >= '${lastYearStart}' AND dt_geracao < '${endDate}'
        GROUP BY YEAR(dt_geracao), MONTH(dt_geracao)
        ORDER BY 1, 2`;
      out.est_mov_monthly = getRows(await runQuery(source, wrap(movMonSql))).map(r => ({
        ano: Number(r.ano), mes: Number(r.mes), qtd: Number(r.qtd) || 0,
      }));
    } catch (e) { out.errors.push('est_mov_monthly: ' + (e.message || '').slice(0, 80)); }

    // ── 10. Top clientes por CAR (dados + nomes resolvidos depois) ──
    let topCarRows = [];
    try {
      const topSql = `SELECT TOP 50 cd_pessoa_cli,
        COUNT(*) AS qtd_car,
        ISNULL(SUM(vl_pre_car),0) AS vl_total,
        ISNULL(SUM(CASE WHEN dt_bai_car IS NULL AND dt_cancelamento IS NULL THEN vl_pre_car ELSE 0 END),0) AS vl_aberto
        FROM car WITH (NOLOCK)
        WHERE dt_emi_car >= '${startDate}' AND dt_emi_car < '${endDate}' AND dt_cancelamento IS NULL${empCar}
        GROUP BY cd_pessoa_cli
        ORDER BY ISNULL(SUM(vl_pre_car),0) DESC`;
      topCarRows = getRows(await runQuery(source, wrap(topSql)));
    } catch (e) { out.errors.push('top_clients_car: ' + (e.message || '').slice(0, 80)); }

    // ── 11. Balancete analítico (plano + CAP join) ──
    try {
      const balSql = `SELECT p.cd_planfin, p.nr_planfin, p.ds_planfin, p.fl_cla_planfin, p.fl_resultpatr,
        ISNULL(SUM(c.vl_pre_cap),0) AS vl_total,
        ISNULL(SUM(CASE WHEN c.dt_bai_cap IS NULL THEN c.vl_pre_cap ELSE 0 END),0) AS vl_aberto,
        ISNULL(SUM(CASE WHEN c.dt_bai_cap IS NOT NULL THEN c.vl_pre_cap ELSE 0 END),0) AS vl_baixado,
        COUNT(c.cd_lan) AS qtd
        FROM plano p WITH (NOLOCK)
        LEFT JOIN cap c WITH (NOLOCK) ON p.cd_planfin = c.cd_conta
          AND c.dt_emi_cap >= '${startDate}' AND c.dt_emi_cap < '${endDate}'
        WHERE p.fl_planfin <> 'N' OR p.fl_planfin IS NULL
        GROUP BY p.cd_planfin, p.nr_planfin, p.ds_planfin, p.fl_cla_planfin, p.fl_resultpatr
        HAVING COUNT(c.cd_lan) > 0
        ORDER BY p.nr_planfin`;
      out.plano_balancete = getRows(await runQuery(source, wrap(balSql))).map(r => ({
        cd_planfin: Number(r.cd_planfin) || 0,
        nr_planfin: String(r.nr_planfin || ''),
        ds_planfin: String(r.ds_planfin || ''),
        fl_cla_planfin: String(r.fl_cla_planfin || ''),
        fl_resultpatr: String(r.fl_resultpatr || ''),
        vl_total: Number(r.vl_total) || 0,
        vl_aberto: Number(r.vl_aberto) || 0,
        vl_baixado: Number(r.vl_baixado) || 0,
        qtd: Number(r.qtd) || 0,
      }));
    } catch (e) { out.errors.push('plano_balancete: ' + (e.message || '').slice(0, 80)); }

    // ── 12. Novos clientes por mês (primeira locação — fich_loc) ──
    try {
      const ncmSql = `SELECT YEAR(first_ficha) AS ano, MONTH(first_ficha) AS mes, COUNT(*) AS qtd
        FROM (
          SELECT cd_pessoa, MIN(dt_pedido) AS first_ficha
          FROM fich_loc WITH (NOLOCK)
          WHERE dt_pedido >= '${lastYearStart}' AND dt_pedido < '${endDate}'${empFich}
            AND cd_pessoa IS NOT NULL AND cd_pessoa <> ''
          GROUP BY cd_pessoa
        ) x
        WHERE first_ficha >= '${lastYearStart}' AND first_ficha < '${endDate}'
        GROUP BY YEAR(first_ficha), MONTH(first_ficha)
        ORDER BY 1, 2`;
      out.new_clients_monthly = getRows(await runQuery(source, wrap(ncmSql))).map(r => ({
        ano: Number(r.ano), mes: Number(r.mes), qtd: Number(r.qtd) || 0,
      }));
    } catch (e) { out.errors.push('new_clients_monthly: ' + (e.message || '').slice(0, 80)); }

    // ── 12b. Total de pessoas cadastradas ──
    try {
      const pSql = `SELECT COUNT(*) AS total FROM pessoa WITH (NOLOCK)`;
      const pRows = getRows(await runQuery(source, wrap(pSql)));
      out.pessoa_total = Number(pRows[0]?.total) || 0;
    } catch (e) { out.errors.push('pessoa_total: ' + (e.message || '').slice(0, 80)); }

    // ── 12b2. Clientes ativos por locação (fich_loc) ──
    try {
      const fcaSql = `SELECT COUNT(DISTINCT cd_pessoa) AS total
        FROM fich_loc WITH (NOLOCK)
        WHERE dt_pedido >= '${startDate}' AND dt_pedido < '${endDate}'${empFich}
          AND cd_pessoa IS NOT NULL AND cd_pessoa <> ''`;
      out.fichloc_clientes_ativos = Number(getRows(await runQuery(source, wrap(fcaSql)))[0]?.total) || 0;
    } catch (e) { out.errors.push('fichloc_clientes_ativos: ' + (e.message || '').slice(0, 80)); }

    // ── 12c. Top clientes por locações (fich_loc × pessoa — dados + nomes depois) ──
    let topLocRows = [];
    try {
      const topLocSql = `SELECT TOP 20 cd_pessoa,
        COUNT(*) AS qtd_loc,
        ISNULL(SUM(vl_minimo_locacao),0) AS vl_minimo,
        ISNULL(SUM(CASE WHEN dt_enc_ficha IS NULL AND fl_baixada <> 'S' THEN 1 ELSE 0 END),0) AS qtd_ativas
        FROM fich_loc WITH (NOLOCK)
        WHERE dt_pedido >= '${startDate}' AND dt_pedido < '${endDate}'${empFich}
        GROUP BY cd_pessoa
        ORDER BY COUNT(*) DESC`;
      topLocRows = getRows(await runQuery(source, wrap(topLocSql)));
    } catch (e) { out.errors.push('fichloc_top_clientes: ' + (e.message || '').slice(0, 80)); }

    // ── 12d. Resolução de nomes unificada (CAR + fich_loc em um único batch) ──
    try {
      const allCodes = [...new Set([
        ...topCarRows.map(r => Number(r.cd_pessoa_cli)),
        ...topLocRows.map(r => Number(r.cd_pessoa)),
      ])].filter(Boolean);
      const nameMap = {};
      for (let i = 0; i < allCodes.length; i += 200) {
        const batch = allCodes.slice(i, i + 200);
        try {
          const namesSql = `SELECT cd_pessoa, nm_pessoa FROM pessoa WITH (NOLOCK) WHERE cd_pessoa IN (${batch.join(',')})`;
          for (const r of getRows(await runQuery(source, wrap(namesSql)))) {
            nameMap[Number(r.cd_pessoa)] = String(r.nm_pessoa || '');
          }
        } catch {}
      }
      out.top_clients_car = topCarRows.map(r => ({
        cd_pessoa: Number(r.cd_pessoa_cli),
        nm_pessoa: nameMap[Number(r.cd_pessoa_cli)] || `Cliente ${r.cd_pessoa_cli}`,
        qtd_car: Number(r.qtd_car) || 0,
        vl_total: Number(r.vl_total) || 0,
        vl_aberto: Number(r.vl_aberto) || 0,
      }));
      out.fichloc_top_clientes = topLocRows.map(r => ({
        cd_pessoa: Number(r.cd_pessoa),
        nm_pessoa: nameMap[Number(r.cd_pessoa)] || `Cliente ${r.cd_pessoa}`,
        qtd_loc: Number(r.qtd_loc) || 0,
        qtd_ativas: Number(r.qtd_ativas) || 0,
        vl_minimo: Number(r.vl_minimo) || 0,
      }));
    } catch (e) { out.errors.push('name_resolution: ' + (e.message || '').slice(0, 80)); }

    // ── 12e. Receita gerada (fl_fatura) por empresa — valor pré-faturamento ──
    try {
      const rgSql = `SELECT c.cd_empresa,
        COUNT(*) AS qtd,
        ISNULL(SUM(f.vl_fatura),0) AS vl_gerado
        FROM fl_fatura f WITH (NOLOCK)
        INNER JOIN fich_loc c WITH (NOLOCK) ON c.cd_controle = f.cd_controle
        WHERE f.dt_geracao >= '${startDate}' AND f.dt_geracao < '${endDate}'${empFatGerada}
        GROUP BY c.cd_empresa
        ORDER BY ISNULL(SUM(f.vl_fatura),0) DESC`;
      out.receita_gerada_by_empresa = getRows(await runQuery(source, wrap(rgSql), 30000)).map(r => ({
        cd_empresa: Number(r.cd_empresa) || null,
        qtd: Number(r.qtd) || 0,
        vl_gerado: Number(r.vl_gerado) || 0,
      }));
    } catch (e) { out.errors.push('receita_gerada_by_empresa: ' + (e.message || '').slice(0, 80)); }

    // ── 13. KPIs consolidados ──
    try {
      const carTotal = out.car_by_empresa.reduce((s, r) => s + r.vl_total, 0);
      const carAberto = out.car_by_empresa.reduce((s, r) => s + r.vl_aberto, 0);
      const carBaixado = out.car_by_empresa.reduce((s, r) => s + r.vl_baixado, 0);
      const carVencido = out.car_by_empresa.reduce((s, r) => s + r.vl_vencido, 0);
      const capTotal = out.cap_by_empresa.reduce((s, r) => s + r.vl_total, 0) || out.cap_by_conta.reduce((s, r) => s + r.vl_total, 0);
      const capAberto = out.cap_by_empresa.reduce((s, r) => s + r.vl_aberto, 0) || out.cap_by_conta.reduce((s, r) => s + r.vl_aberto, 0);
      const capBaixado = out.cap_by_empresa.reduce((s, r) => s + r.vl_baixado, 0) || out.cap_by_conta.reduce((s, r) => s + r.vl_baixado, 0);
      const capVencido = out.cap_by_conta.reduce((s, r) => s + r.vl_vencido, 0);
      const fichTotal = out.fichloc_by_empresa.reduce((s, r) => s + r.qtd, 0);
      const fichAtivas = out.fichloc_by_empresa.reduce((s, r) => s + r.qtd_ativas, 0);
      const fichEncerradas = out.fichloc_by_empresa.reduce((s, r) => s + r.qtd_encerradas, 0);
      const movTotal = out.est_mov_by_operacao.reduce((s, r) => s + r.qtd, 0);

      // Derive fichloc_by_status from by_empresa
      out.fichloc_by_status = [
        { status: 'Ativas', qtd: fichAtivas },
        { status: 'Encerradas', qtd: fichEncerradas },
      ];

      // Derive car_vs_cap_monthly from monthly series
      const mm = {};
      out.car_monthly.forEach(r => { const k = `${r.ano}-${r.mes}`; mm[k] = { ...mm[k], label: fmtMonth(r.mes, r.ano), car: r.vl_total, car_baixado: r.vl_baixado }; });
      out.cap_monthly.forEach(r => { const k = `${r.ano}-${r.mes}`; mm[k] = { ...mm[k], label: fmtMonth(r.mes, r.ano), cap: r.vl_total, cap_baixado: r.vl_baixado }; });
      out.car_vs_cap_monthly = Object.values(mm).sort((a, b) => String(a.label).localeCompare(String(b.label)));

      const receitaGerada = cdEmpresa != null
        ? (out.receita_gerada_by_empresa[0]?.vl_gerado || 0)
        : out.receita_gerada_by_empresa.reduce((s, r) => s + (r.vl_gerado || 0), 0);
      out.kpis = {
        car_total: carTotal,
        receita_gerada: receitaGerada,
        car_aberto: carAberto,
        car_baixado: carBaixado,
        car_vencido: carVencido,
        cap_total: capTotal,
        cap_aberto: capAberto,
        cap_baixado: capBaixado,
        cap_vencido: capVencido,
        margem_fluxo: carTotal - capTotal,
        margem_percent: carTotal > 0 ? ((carTotal - capTotal) / carTotal * 100) : null,
        fichloc_total: fichTotal,
        fichloc_ativas: fichAtivas,
        fichloc_encerradas: fichEncerradas,
        est_mov_total: movTotal,
        pessoa_total: out.pessoa_total,
        fichloc_clientes_ativos: out.fichloc_clientes_ativos,
        top_clients_count: out.top_clients_car.length,
      };
    } catch (e) { out.errors.push('kpis: ' + (e.message || '').slice(0, 80)); }

    return Response.json({ success: true, ...out });
  } catch (error) {
    return Response.json({ success: false, error: error.message || String(error) }, { status: 500 });
  }
});