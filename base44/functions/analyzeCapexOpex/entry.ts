import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { execRead } from '../../shared/erpConnection.ts';
import { resolvePeriod } from '../../shared/periodContract.ts';

// Base completa de ativos (patrimônio + estoque locável), manutenção por família
// e CAP classificado em CAPEX x OPEX pelo plano financeiro.
const rowsOf = (result: any): any[] => {
  if (Array.isArray(result?.recordset) && result.recordset.length > 0) return result.recordset;
  if (Array.isArray(result?.recordsets)) {
    for (let i = result.recordsets.length - 1; i >= 0; i--) {
      const rs = result.recordsets[i];
      if (Array.isArray(rs) && rs.length > 0) return rs;
    }
  }
  return [];
};

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const today = new Date().toISOString().slice(0, 10);
    const resolvedPeriod = resolvePeriod({
      start: body?.start_date,
      endInclusive: body?.end_date,
      endExclusive: body?.end_date_exclusive,
      defaultStart: new Date(new Date(`${today}T12:00:00Z`).getTime() - 365 * 86400000).toISOString().slice(0, 10),
      defaultEndInclusive: today,
    });
    const end = resolvedPeriod.endInclusive;
    const endExclusive = resolvedPeriod.endExclusive;
    const start12 = body?.start_date ? resolvedPeriod.start : new Date(new Date(`${end}T12:00:00Z`).getTime() - 365 * 86400000).toISOString().slice(0, 10);

    let source: Record<string, unknown> = { credential_reference: 'env' };
    if (body?.source_id) {
      source = await base44.asServiceRole.entities.ErpDataSource.get(body.source_id);
      if (!source) return Response.json({ error: 'Fonte de dados não encontrada.' }, { status: 404 });
    }

    const t0 = Date.now();
    const warnings: string[] = [];

    const sqlPatrimonio = `SELECT COALESCE(g.nm_grupo, '(sem grupo)') AS grupo,
        COUNT(*) AS qtd,
        SUM(COALESCE(p.vl_aqu_patrimonio, 0)) AS vl_aquisicao,
        AVG(CASE WHEN p.dt_aqu_patrimonio IS NOT NULL
            THEN DATEDIFF(month, p.dt_aqu_patrimonio, GETDATE()) / 12.0 END) AS idade_media,
        SUM(CASE WHEN p.dt_aqu_patrimonio >= '${start12}' THEN COALESCE(p.vl_aqu_patrimonio, 0) ELSE 0 END) AS capex_12m,
        SUM(CASE WHEN p.dt_aqu_patrimonio IS NOT NULL AND DATEDIFF(month, p.dt_aqu_patrimonio, GETDATE()) > 120 THEN 1 ELSE 0 END) AS qtd_acima_10a
      FROM patrimon p WITH (NOLOCK)
      LEFT JOIN equipto e WITH (NOLOCK) ON e.cd_equipto = p.cd_equipto
      LEFT JOIN grupo g WITH (NOLOCK) ON g.cd_grupo = e.cd_grupo
      WHERE UPPER(COALESCE(p.fl_vendido, 'N')) <> 'S'
      GROUP BY g.nm_grupo`;

    const sqlEstoque = `SELECT COALESCE(g.nm_grupo, '(sem grupo)') AS grupo,
        COUNT(DISTINCT e.cd_equipto) AS itens,
        SUM(COALESCE(x.qt_atual, 0)) AS qt,
        SUM(COALESCE(x.qt_atual, 0) * COALESCE(NULLIF(e.vl_aqu_equipto, 0), e.vl_venda_fabric, 0)) AS vl_aquisicao
      FROM equipto e WITH (NOLOCK)
      LEFT JOIN grupo g WITH (NOLOCK) ON g.cd_grupo = e.cd_grupo
      LEFT JOIN est_almox_xequ_xpes x WITH (NOLOCK) ON x.cd_equipto = e.cd_equipto
      WHERE UPPER(COALESCE(e.fl_pat_equipto, 'N')) <> 'S'
        AND UPPER(COALESCE(e.fl_loc_equipto, 'N')) = 'S'
      GROUP BY g.nm_grupo
      HAVING SUM(COALESCE(x.qt_atual, 0)) > 0`;

    const sqlManutencao = `SELECT COALESCE(g.nm_grupo, '(sem grupo)') AS grupo,
        COUNT(*) AS qtd_os,
        SUM(COALESCE(o.vl_custoos_material, 0) + COALESCE(o.vl_custoos_servico, 0) + COALESCE(o.vl_custoos_terceiro, 0)) AS custo_12m,
        SUM(COALESCE(o.vl_custoos_material, 0)) AS material_12m,
        SUM(COALESCE(o.vl_custoos_servico, 0)) AS servico_12m,
        SUM(COALESCE(o.vl_custoos_terceiro, 0)) AS terceiro_12m
      FROM orcos o WITH (NOLOCK)
      LEFT JOIN equipto e WITH (NOLOCK) ON e.cd_equipto = o.cd_equipto
      LEFT JOIN grupo g WITH (NOLOCK) ON g.cd_grupo = e.cd_grupo
      WHERE o.dt_abertura >= '${start12}' AND o.dt_abertura < '${endExclusive}'
        AND UPPER(COALESCE(o.fl_propriedade, 'P')) = 'P'
      GROUP BY g.nm_grupo`;

    // Plano financeiro tem 9 dígitos (GG BB SSS): o bloco de 4 dígitos define a natureza do gasto.
    const sqlCap = `SELECT LTRIM(RTRIM(COALESCE(pl.nr_planfin, ''))) AS nr_planfin,
        COALESCE(NULLIF(LTRIM(RTRIM(pl.ds_planfin)), ''), 'Sem conta vinculada') AS ds_planfin,
        LEFT(LTRIM(RTRIM(COALESCE(pl.nr_planfin, '0000'))), 4) AS bloco,
        COALESCE(NULLIF(LTRIM(RTRIM(bl.ds_planfin)), ''), 'Sem bloco') AS ds_bloco,
        COUNT(*) AS qtd,
        SUM(v.val) AS vl_12m
      FROM cap c WITH (NOLOCK)
      LEFT JOIN plano pl WITH (NOLOCK) ON pl.cd_planfin = c.cd_conta
      LEFT JOIN plano bl WITH (NOLOCK)
        ON LTRIM(RTRIM(bl.nr_planfin)) = LEFT(LTRIM(RTRIM(pl.nr_planfin)), 4) + '00000'
      CROSS APPLY (SELECT ROUND(COALESCE(c.vl_pre_cap, 0) + COALESCE(c.vl_acr_cap, 0) - COALESCE(c.vl_des_cap, 0), 2) AS val) v
      WHERE c.dt_emi_cap >= '${start12}' AND c.dt_emi_cap < '${endExclusive}'
        AND c.fl_status_titulo <> 40
      GROUP BY pl.nr_planfin, pl.ds_planfin, bl.ds_planfin
      ORDER BY SUM(v.val) DESC`;

    const run = async (label: string, sql: string) => {
      try {
        const r = await execRead(source, sql, 45000);
        return rowsOf(r);
      } catch (e) {
        warnings.push(`${label}: ${(e as Error)?.message || String(e)}`);
        return [];
      }
    };

    const patrimonio = await run('Patrimônios', sqlPatrimonio);
    const estoque = await run('Ativos de estoque', sqlEstoque);
    const manutencao = await run('Manutenção 12m', sqlManutencao);
    const cap = await run('CAP por conta', sqlCap);

    const num = (v: unknown) => Number(v || 0);
    const asset: Record<string, any> = {};
    const touch = (g: string) => {
      const key = String(g || '(sem grupo)');
      if (!asset[key]) {
        asset[key] = {
          grupo: key, patrimonios: 0, vl_patrimonio: 0, idade_media: null,
          capex_12m: 0, qtd_acima_10a: 0, itens_estoque: 0, qt_estoque: 0,
          vl_estoque: 0, qtd_os: 0, manutencao_12m: 0,
          material_12m: 0, servico_12m: 0, terceiro_12m: 0,
        };
      }
      return asset[key];
    };

    for (const r of patrimonio) {
      const a = touch(r.grupo);
      a.patrimonios = num(r.qtd);
      a.vl_patrimonio = num(r.vl_aquisicao);
      a.idade_media = r.idade_media === null ? null : Number(r.idade_media);
      a.capex_12m += num(r.capex_12m);
      a.qtd_acima_10a = num(r.qtd_acima_10a);
    }
    for (const r of estoque) {
      const a = touch(r.grupo);
      a.itens_estoque = num(r.itens);
      a.qt_estoque = num(r.qt);
      a.vl_estoque = num(r.vl_aquisicao);
    }
    for (const r of manutencao) {
      const a = touch(r.grupo);
      a.qtd_os = num(r.qtd_os);
      a.manutencao_12m = num(r.custo_12m);
      a.material_12m = num(r.material_12m);
      a.servico_12m = num(r.servico_12m);
      a.terceiro_12m = num(r.terceiro_12m);
    }

    const grupos = Object.values(asset)
      .map((a: any) => ({ ...a, vl_total: a.vl_patrimonio + a.vl_estoque }))
      .filter((a: any) => a.vl_total > 0 || a.manutencao_12m > 0 || a.qt_estoque > 0 || a.patrimonios > 0)
      .sort((a: any, b: any) => b.vl_total - a.vl_total);

    return Response.json({
      generated_at: new Date().toISOString(),
      period: { start: start12, end, end_exclusive: endExclusive },
      grupos,
      cap: cap.map((r: any) => ({
        nr_planfin: String(r.nr_planfin || ''),
        ds_planfin: String(r.ds_planfin || ''),
        bloco: String(r.bloco || ''),
        ds_bloco: String(r.ds_bloco || ''),
        qtd: num(r.qtd),
        vl_12m: num(r.vl_12m),
      })),
      warnings,
      duration_ms: Date.now() - t0,
      queries: [
        { label: 'Ativos com patrimônio', description: 'patrimon + equipto/grupo — quantidade, valor de aquisição e idade', sql: sqlPatrimonio },
        { label: 'Ativos de estoque locável', description: 'est_almox_xequ_xpes — andaimes, multidirecional, escoramento e demais itens por quantidade', sql: sqlEstoque },
        { label: 'Manutenção 12 meses', description: 'orcos — custo de material, serviço e terceiros em ativos próprios', sql: sqlManutencao },
        { label: 'CAP por conta do plano financeiro', description: 'cap + plano — base para separar CAPEX de OPEX', sql: sqlCap },
      ],
    });
  } catch (error) {
    return Response.json({ error: (error as Error)?.message || String(error) }, { status: 500 });
  }
}