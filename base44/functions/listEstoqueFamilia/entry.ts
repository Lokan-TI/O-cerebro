import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { execRead } from '../../shared/erpConnection.ts';

// Estoque quantitativo de ANDAIMES x ESCORAMENTO usando a classificação de famílias do Cérebro (GrupoFamilia).
// Saldo = qt_saldo_atual do último movimento de estoque (est_movitem) de cada item.

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') {
      return Response.json({ error: 'Consulta restrita a administradores.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const familias = Array.isArray(body?.familias) && body.familias.length
      ? body.familias
      : ['ANDAIMES', 'ESCORAMENTO'];

    let source: any = { credential_reference: 'env' };
    if (body?.source_id) {
      source = await base44.asServiceRole.entities.ErpDataSource.get(body.source_id);
      if (!source || source.is_active === false) {
        return Response.json({ error: 'Fonte de dados indisponível.' }, { status: 404 });
      }
    }

    const mapa = await base44.asServiceRole.entities.GrupoFamilia.filter({});
    const doEscopo = mapa.filter((g: any) => familias.includes(g.familia));
    if (doEscopo.length === 0) {
      return Response.json({ error: 'Nenhum grupo classificado nas famílias solicitadas.' }, { status: 400 });
    }

    const grupos = doEscopo.map((g: any) => Number(g.cd_grupo)).filter((n: number) => Number.isFinite(n));
    const familiaPorGrupo = new Map(doEscopo.map((g: any) => [Number(g.cd_grupo), g.familia]));
    const lista = grupos.join(', ');

    const sql = `WITH ult AS (
  SELECT m.cd_equipto, m.qt_saldo_atual,
         ROW_NUMBER() OVER (PARTITION BY m.cd_equipto ORDER BY m.dt_mov DESC, m.cd_movitem DESC) AS rn
  FROM est_movitem m
  WHERE m.cd_equipto IN (SELECT cd_equipto FROM equipto WHERE cd_grupo IN (${lista}))
)
SELECT e.cd_equipto, e.nm_equipto, e.cd_grupo, g.nm_grupo,
       CAST(ISNULL(u.qt_saldo_atual, 0) AS decimal(18,2)) AS qt_saldo
FROM ult u
JOIN equipto e ON e.cd_equipto = u.cd_equipto
LEFT JOIN grupo g ON g.cd_grupo = e.cd_grupo
WHERE u.rn = 1
ORDER BY e.cd_grupo, ISNULL(u.qt_saldo_atual, 0) DESC`;

    const result = await execRead(source, sql, 25000);
    const rows = (result.recordset || []).map((r: any) => ({
      cd_equipto: r.cd_equipto,
      nm_equipto: r.nm_equipto,
      cd_grupo: r.cd_grupo,
      nm_grupo: r.nm_grupo,
      qt_saldo: Number(r.qt_saldo) || 0,
      familia: familiaPorGrupo.get(Number(r.cd_grupo)) || 'NAO CLASSIFICADO',
    }));

    const porFamilia: Record<string, any> = {};
    for (const f of familias) {
      porFamilia[f] = { familia: f, saldo: 0, itens: 0, itens_com_saldo: 0, itens_zerados: 0, grupos: [] };
    }
    const porGrupo = new Map<string, any>();

    for (const r of rows) {
      const fam = porFamilia[r.familia];
      if (!fam) continue;
      fam.saldo += r.qt_saldo;
      fam.itens += 1;
      if (r.qt_saldo > 0) fam.itens_com_saldo += 1;
      else fam.itens_zerados += 1;

      const key = `${r.familia}|${r.cd_grupo}`;
      if (!porGrupo.has(key)) {
        porGrupo.set(key, {
          familia: r.familia,
          cd_grupo: r.cd_grupo,
          nm_grupo: r.nm_grupo || `Grupo ${r.cd_grupo}`,
          saldo: 0,
          itens: 0,
        });
      }
      const g = porGrupo.get(key);
      g.saldo += r.qt_saldo;
      g.itens += 1;
    }

    for (const g of porGrupo.values()) {
      porFamilia[g.familia]?.grupos.push(g);
    }
    for (const f of Object.values(porFamilia) as any[]) {
      f.grupos.sort((a: any, b: any) => b.saldo - a.saldo);
    }

    return Response.json({
      familias: Object.values(porFamilia),
      itens: rows,
      generated_at: new Date().toISOString(),
      queries: [sql],
    });
  } catch (error) {
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
}