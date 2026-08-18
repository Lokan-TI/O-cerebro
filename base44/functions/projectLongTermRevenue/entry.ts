import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { buildConfig, runQuery, closePool } from '../../shared/erpConnection.ts';

// Base factual para projeção de longo prazo:
// 1) histórico anual de receita (nf) · 2) histórico de compras de ativos (patrimon)
// 3) foto atual da frota (valor, idade, quantidade). Toda a modelagem de cenários
// é feita na camada de experiência (src/lib/longTermProjection.js).
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const years = Math.min(Math.max(Number(body?.years) || 10, 3), 20);
    const sourceId = body?.source_id;
    const refresh = body?.refresh === true;

    // Cache: por padrão devolvemos o último snapshot salvo (leitura instantânea, zero
    // carga no ERP). O ERP só é consultado quando o usuário pede atualização.
    const cached = await base44.asServiceRole.entities.ProjectionSnapshot.filter(
      { source_id: sourceId || '', is_current: true }, '-generated_at', 1
    );
    if (!refresh) {
      const s = cached[0];
      if (!s) {
        return Response.json({
          no_snapshot: true,
          message: 'Nenhum snapshot desta fonte foi gerado ainda. Clique em "Atualizar do ERP" para calcular a primeira vez.',
        });
      }
      return Response.json({
        from_cache: true,
        generated_at: s.generated_at,
        current_year: s.current_year,
        year_fraction: s.year_fraction,
        history: s.history || [],
        fleet: s.fleet || {},
        queries: s.queries || [],
        warnings: s.warnings || [],
      });
    }
    const startedAt = Date.now();
    let source: any = { credential_reference: 'env' };
    if (sourceId) {
      source = await base44.asServiceRole.entities.ErpDataSource.get(sourceId);
      if (!source) return Response.json({ error: 'Fonte de dados não encontrada.' }, { status: 404 });
      if (source.is_active === false) return Response.json({ error: 'A fonte selecionada está inativa.' }, { status: 403 });
    }
    const built = buildConfig(source);
    if (!built) return Response.json({ error: 'Configuração de conexão incompleta.' }, { status: 500 });

    const wrap = (sql: string) =>
      built.clientId ? `EXEC DW_API '${built.clientId}', '${sql.replace(/'/g, "''")}'` : sql;
    const getRows = (res: any) => res?.recordset || res?.rows || [];
    const start = `DATEFROMPARTS(YEAR(GETDATE())-${years},1,1)`;

    const sqlRevenue = `SELECT YEAR(dt_emi_nf) AS ano,
        ISNULL(SUM(vl_faturamento),0) AS receita,
        COUNT(*) AS nfs,
        COUNT(DISTINCT cd_pessoa) AS clientes
      FROM nf WITH (NOLOCK)
      WHERE dt_emi_nf >= ${start} AND dt_emi_nf < GETDATE()
      GROUP BY YEAR(dt_emi_nf) ORDER BY 1`;

    const sqlCapex = `SELECT YEAR(dt_aqu_patrimonio) AS ano,
        COUNT(*) AS ativos,
        ISNULL(SUM(vl_aqu_patrimonio),0) AS capex
      FROM patrimon WITH (NOLOCK)
      WHERE dt_aqu_patrimonio >= ${start} AND dt_aqu_patrimonio < GETDATE()
      GROUP BY YEAR(dt_aqu_patrimonio) ORDER BY 1`;

    const sqlFleet = `SELECT COUNT(*) AS ativos_total,
        SUM(CASE WHEN ISNULL(fl_vendido,'N') <> 'S' THEN 1 ELSE 0 END) AS ativos_ativos,
        ISNULL(SUM(CASE WHEN ISNULL(fl_vendido,'N') <> 'S' THEN vl_aqu_patrimonio ELSE 0 END),0) AS valor_frota,
        ISNULL(SUM(vl_aqu_patrimonio),0) AS capex_historico_total,
        AVG(CASE WHEN ISNULL(fl_vendido,'N') <> 'S' AND dt_aqu_patrimonio IS NOT NULL
              THEN DATEDIFF(month, dt_aqu_patrimonio, GETDATE())/12.0 END) AS idade_media,
        SUM(CASE WHEN ISNULL(fl_vendido,'N') <> 'S' AND dt_aqu_patrimonio < DATEADD(year,-10,GETDATE()) THEN 1 ELSE 0 END) AS ativos_acima_10a
      FROM patrimon WITH (NOLOCK)`;

    const sqlFleetGroup = `SELECT TOP 12 g.nm_grupo AS grupo,
        COUNT(*) AS ativos,
        ISNULL(SUM(pt.vl_aqu_patrimonio),0) AS valor,
        AVG(CASE WHEN pt.dt_aqu_patrimonio IS NOT NULL THEN DATEDIFF(month, pt.dt_aqu_patrimonio, GETDATE())/12.0 END) AS idade_media
      FROM patrimon pt WITH (NOLOCK)
      LEFT JOIN equipto q WITH (NOLOCK) ON q.cd_equipto = pt.cd_equipto
      LEFT JOIN grupo g WITH (NOLOCK) ON g.cd_grupo = q.cd_grupo
      WHERE ISNULL(pt.fl_vendido,'N') <> 'S'
      GROUP BY g.nm_grupo
      ORDER BY ISNULL(SUM(pt.vl_aqu_patrimonio),0) DESC`;

    const num = (v: any) => Number(v) || 0;
    const warnings: string[] = [];
    // Cada consulta tem teto próprio de 15s e falha isolada — evita que uma consulta
    // lenta some com o tempo total da requisição e deixe a tela carregando sem fim.
    const q = async (label: string, sql: string) => {
      try {
        return getRows(await runQuery(source, wrap(sql), 15000));
      } catch (e) {
        warnings.push(`${label}: ${(e.message || String(e)).slice(0, 140)}`);
        return [];
      }
    };
    const revenueRows = await q('Receita anual', sqlRevenue);
    if (revenueRows.length === 0) {
      return Response.json({
        error: 'Não foi possível ler o histórico de receita do ERP (consulta excedeu 15s ou conexão recusada). Tente recarregar em alguns instantes.',
        warnings,
      });
    }
    const capexRows = await q('Compras de ativos', sqlCapex);
    const fleetRow = (await q('Foto da frota', sqlFleet))[0] || {};
    const groupRows = await q('Frota por grupo', sqlFleetGroup);

    const now = new Date();
    const currentYear = now.getFullYear();
    // Fração do ano corrente já decorrida — usada para anualizar o ano em curso.
    const yearFraction = ((now.getTime() - new Date(currentYear, 0, 1).getTime()) /
      (new Date(currentYear + 1, 0, 1).getTime() - new Date(currentYear, 0, 1).getTime()));

    const capexByYear: Record<number, any> = {};
    for (const r of capexRows) {
      capexByYear[num(r.ano)] = { ativos: num(r.ativos), capex: num(r.capex) };
    }

    const history = revenueRows.map((r: any) => {
      const ano = num(r.ano);
      const receita = num(r.receita);
      const partial = ano === currentYear;
      const c = capexByYear[ano] || { ativos: 0, capex: 0 };
      return {
        ano,
        receita,
        receita_anualizada: partial && yearFraction > 0 ? receita / yearFraction : receita,
        nfs: num(r.nfs),
        clientes: num(r.clientes),
        capex: c.capex,
        capex_anualizado: partial && yearFraction > 0 ? c.capex / yearFraction : c.capex,
        ativos_comprados: c.ativos,
        parcial: partial,
      };
    });

    const fleet = {
      ativos_total: num(fleetRow.ativos_total),
      ativos_ativos: num(fleetRow.ativos_ativos),
      valor_frota: num(fleetRow.valor_frota),
      capex_historico_total: num(fleetRow.capex_historico_total),
      idade_media: Number(fleetRow.idade_media) || null,
      ativos_acima_10a: num(fleetRow.ativos_acima_10a),
      por_grupo: groupRows.map((r: any) => ({
        grupo: String(r.grupo || 'Sem grupo'),
        ativos: num(r.ativos),
        valor: num(r.valor),
        idade_media: Number(r.idade_media) || null,
      })),
    };

    const queries = [
      { label: 'Receita anual', description: 'nf — faturamento, notas e clientes por ano', sql: sqlRevenue },
      { label: 'Compras de ativos por ano', description: 'patrimon — CAPEX e quantidade por ano de aquisição', sql: sqlCapex },
      { label: 'Foto da frota', description: 'patrimon — valor, idade média e ativos acima de 10 anos', sql: sqlFleet },
      { label: 'Frota por grupo', description: 'patrimon + equipto + grupo — concentração de capital', sql: sqlFleetGroup },
    ];
    const payload = {
      generated_at: now.toISOString(),
      current_year: currentYear,
      year_fraction: yearFraction,
      history,
      fleet,
      warnings,
      queries,
    };

    // Publica o novo snapshot e desmarca o anterior
    try {
      await base44.asServiceRole.entities.ProjectionSnapshot.create({
        source_id: sourceId || '',
        source_name: source?.name || 'Fonte padrão',
        is_current: false,
        generated_at: payload.generated_at,
        generated_by_name: user.full_name || user.email,
        years,
        current_year: currentYear,
        year_fraction: yearFraction,
        history,
        fleet,
        queries,
        warnings,
        duration_ms: Date.now() - startedAt,
      }).then(async (snap: any) => {
        for (const old of cached) {
          await base44.asServiceRole.entities.ProjectionSnapshot.update(old.id, { is_current: false });
        }
        await base44.asServiceRole.entities.ProjectionSnapshot.update(snap.id, { is_current: true });
      });
    } catch (e) {
      payload.warnings.push('Falha ao salvar snapshot: ' + (e.message || String(e)).slice(0, 120));
    }

    return Response.json({ ...payload, from_cache: false });
  } catch (error) {
    try {
      const body2 = await req.clone().json().catch(() => ({}));
      if (body2?.source_id) await closePool({ id: body2.source_id, credential_reference: 'entity' });
      else await closePool({ credential_reference: 'env' });
    } catch {}
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
});