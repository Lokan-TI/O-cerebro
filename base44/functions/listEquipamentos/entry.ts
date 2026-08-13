import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { buildConfig, runQuery, closePool } from '../../shared/erpConnection.ts';

// Catálogo de produtos/equipamentos (equipto) com os patrimônios vinculados (patrimon).
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const sourceId = body?.source_id;
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

    const sqlEquip = `SELECT q.cd_equipto, q.nm_equipto, q.codigo, q.fl_ativo,
        q.mc_ven_equipto, q.md_ven_equipto,
        g.nm_grupo, u.sg_unidade, u.ds_unidade, cf.nr_classfiscal, cf.cd_ncm,
        q.dt_ult_compra, q.vl_aqu_equipto, q.vl_venda_fabric, q.dt_venda_fabric,
        q.vl_indenizacao, q.vl_venda_usado, q.vl_teto_compra, q.vl_base_locacao,
        q.peso_liquido, q.peso_bruto,
        CAST(q.observacao AS VARCHAR(4000)) AS observacao
      FROM equipto q WITH (NOLOCK)
      LEFT JOIN grupo g WITH (NOLOCK) ON g.cd_grupo = q.cd_grupo
      LEFT JOIN unidade u WITH (NOLOCK) ON u.cd_unidade = q.cd_unidade
      LEFT JOIN classfiscal cf WITH (NOLOCK) ON cf.cd_classfiscal = q.cd_classfiscal
      ORDER BY q.nm_equipto`;
    const resEquip: any = await runQuery(source, wrap(sqlEquip), 40000);
    const equipRows = resEquip?.recordset || [];

    const sqlPat = `SELECT pt.cd_patrimonio, pt.nr_patrimonio, pt.nr_serie, pt.cd_equipto
      FROM patrimon pt WITH (NOLOCK)`;
    const resPat: any = await runQuery(source, wrap(sqlPat), 40000);
    const patRows = resPat?.recordset || [];

    const byEquipto: Record<string, any[]> = {};
    for (const p of patRows) {
      const key = String(Number(p.cd_equipto) || 0);
      if (!byEquipto[key]) byEquipto[key] = [];
      byEquipto[key].push({
        cd_patrimonio: Number(p.cd_patrimonio) || 0,
        nr_patrimonio: String(p.nr_patrimonio || p.cd_patrimonio || ''),
        nr_serie: String(p.nr_serie || ''),
      });
    }

    const equipamentos = equipRows.map((q: any) => {
      const key = String(Number(q.cd_equipto) || 0);
      const pats = (byEquipto[key] || []).sort((a, b) =>
        a.nr_patrimonio.localeCompare(b.nr_patrimonio, 'pt-BR', { numeric: true })
      );
      const num = (v: any) => (v === null || v === undefined ? null : Number(v));
      const dt = (v: any) => {
        if (!v) return null;
        const d = new Date(v);
        return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
      };
      return {
        cd_equipto: Number(q.cd_equipto) || 0,
        nm_equipto: String(q.nm_equipto || ''),
        codigo: String(q.codigo || ''),
        ativo: String(q.fl_ativo || '').toUpperCase() === 'S' ? 'Sim' : 'Não',
        grupo: String(q.nm_grupo || ''),
        marca: String(q.mc_ven_equipto || ''),
        modelo: String(q.md_ven_equipto || ''),
        unidade: String(q.sg_unidade || q.ds_unidade || ''),
        ncm: String(q.cd_ncm || q.nr_classfiscal || ''),
        dt_ult_compra: dt(q.dt_ult_compra),
        vl_compra: num(q.vl_aqu_equipto),
        vl_fabricante: num(q.vl_venda_fabric),
        dt_vl_fabricante: dt(q.dt_venda_fabric),
        vl_indenizacao: num(q.vl_indenizacao),
        vl_venda_usado: num(q.vl_venda_usado),
        vl_teto_compra: num(q.vl_teto_compra),
        vl_base_locacao: num(q.vl_base_locacao),
        peso_liquido: num(q.peso_liquido),
        peso_bruto: num(q.peso_bruto),
        observacao: String(q.observacao || '').trim(),
        qtd_patrimonios: pats.length,
        patrimonios: pats,
      };
    });

    return Response.json({
      total_equipamentos: equipamentos.length,
      total_patrimonios: patRows.length,
      patrimonios_sem_produto: (byEquipto['0'] || []).length,
      equipamentos,
    });
  } catch (error) {
    try {
      const body2 = await req.clone().json().catch(() => ({}));
      if (body2?.source_id) await closePool({ id: body2.source_id, credential_reference: 'entity' });
      else await closePool({ credential_reference: 'env' });
    } catch {}
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
});