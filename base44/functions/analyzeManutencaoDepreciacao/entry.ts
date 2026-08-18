import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { execRead } from '../../shared/erpConnection.ts';

// Cruzamento item a item (por equipamento) entre custo de manutenção dos últimos
// 12 meses e o valor imobilizado / idade real dos patrimônios daquele equipamento.
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
    const end = String(body?.end_date || new Date().toISOString().slice(0, 10));
    const start12 = new Date(new Date(end).getTime() - 365 * 86400000).toISOString().slice(0, 10);

    let source: Record<string, unknown> = { credential_reference: 'env' };
    if (body?.source_id) {
      source = await base44.asServiceRole.entities.ErpDataSource.get(body.source_id);
      if (!source) return Response.json({ error: 'Fonte de dados não encontrada.' }, { status: 404 });
    }

    const t0 = Date.now();
    const warnings: string[] = [];

    const sqlItens = `SELECT e.cd_equipto,
        COALESCE(NULLIF(LTRIM(RTRIM(e.nm_equipto)), ''), CAST(e.cd_equipto AS VARCHAR(20))) AS nm_equipto,
        COALESCE(g.nm_grupo, '(sem grupo)') AS grupo,
        COUNT(p.cd_patrimonio) AS qtd_patrimonios,
        SUM(COALESCE(p.vl_aqu_patrimonio, 0)) AS vl_aquisicao,
        AVG(CASE WHEN p.dt_aqu_patrimonio IS NOT NULL
            THEN DATEDIFF(month, p.dt_aqu_patrimonio, GETDATE()) / 12.0 END) AS idade_media,
        MAX(CASE WHEN p.dt_aqu_patrimonio IS NOT NULL
            THEN DATEDIFF(month, p.dt_aqu_patrimonio, GETDATE()) / 12.0 END) AS idade_maxima,
        COALESCE(NULLIF(e.vl_base_locacao, 0), 0) AS vl_base_locacao,
        COALESCE(NULLIF(e.vl_venda_usado, 0), 0) AS vl_venda_usado
      FROM patrimon p WITH (NOLOCK)
      INNER JOIN equipto e WITH (NOLOCK) ON e.cd_equipto = p.cd_equipto
      LEFT JOIN grupo g WITH (NOLOCK) ON g.cd_grupo = e.cd_grupo
      WHERE UPPER(COALESCE(p.fl_vendido, 'N')) <> 'S'
      GROUP BY e.cd_equipto, e.nm_equipto, g.nm_grupo, e.vl_base_locacao, e.vl_venda_usado
      HAVING COUNT(p.cd_patrimonio) > 0`;

    const sqlManut = `SELECT o.cd_equipto,
        COUNT(*) AS qtd_os,
        SUM(COALESCE(o.vl_custoos_material, 0) + COALESCE(o.vl_custoos_servico, 0) + COALESCE(o.vl_custoos_terceiro, 0)) AS custo_12m,
        SUM(COALESCE(o.vl_custoos_material, 0)) AS material_12m,
        SUM(COALESCE(o.vl_custoos_servico, 0)) AS servico_12m,
        SUM(COALESCE(o.vl_custoos_terceiro, 0)) AS terceiro_12m,
        CONVERT(char(10), MAX(o.dt_abertura), 120) AS ultima_os
      FROM orcos o WITH (NOLOCK)
      WHERE o.dt_abertura >= '${start12}' AND o.dt_abertura < DATEADD(day, 1, CAST('${end}' AS date))
        AND UPPER(COALESCE(o.fl_propriedade, 'P')) = 'P'
      GROUP BY o.cd_equipto`;

    const run = async (label: string, sql: string, ms = 20000) => {
      try {
        return rowsOf(await execRead(source, sql, ms));
      } catch (e) {
        warnings.push(`${label}: ${(e as Error)?.message || String(e)}`);
        return [];
      }
    };

    const itens = await run('Itens com patrimônio', sqlItens, 25000);
    const manut = await run('Manutenção 12m por item', sqlManut, 25000);

    const num = (v: unknown) => Number(v || 0);
    const byEquip: Record<string, any> = {};
    for (const m of manut) byEquip[String(num(m.cd_equipto))] = m;

    const items = itens.map((r: any) => {
      const m = byEquip[String(num(r.cd_equipto))] || {};
      return {
        cd_equipto: num(r.cd_equipto),
        nm_equipto: String(r.nm_equipto || '').trim(),
        grupo: String(r.grupo || '(sem grupo)'),
        qtd_patrimonios: num(r.qtd_patrimonios),
        vl_aquisicao: num(r.vl_aquisicao),
        idade_media: r.idade_media === null ? null : Number(r.idade_media),
        idade_maxima: r.idade_maxima === null ? null : Number(r.idade_maxima),
        vl_base_locacao: num(r.vl_base_locacao),
        vl_venda_usado: num(r.vl_venda_usado),
        qtd_os: num(m.qtd_os),
        manutencao_12m: num(m.custo_12m),
        material_12m: num(m.material_12m),
        servico_12m: num(m.servico_12m),
        terceiro_12m: num(m.terceiro_12m),
        ultima_os: m.ultima_os ? String(m.ultima_os).slice(0, 10) : null,
      };
    });

    return Response.json({
      generated_at: new Date().toISOString(),
      period: { start: start12, end },
      items,
      warnings,
      duration_ms: Date.now() - t0,
      queries: [
        { label: 'Itens com patrimônio', description: 'patrimon + equipto/grupo — valor imobilizado e idade real por equipamento', sql: sqlItens },
        { label: 'Manutenção 12m por item', description: 'orcos — material, serviço e terceiros por equipamento próprio', sql: sqlManut },
      ],
    });
  } catch (error) {
    return Response.json({ error: (error as Error)?.message || String(error) }, { status: 500 });
  }
}