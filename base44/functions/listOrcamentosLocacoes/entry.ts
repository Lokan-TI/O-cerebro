import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { execRead } from '../../shared/erpConnection.ts';
import { empFilter } from '../../shared/empresaScope.ts';

// Orçamentos (mkt_orcamento.dt_orcamento) x Locações fechadas (fich_loc.dt_pedido)
// por empresa × cliente, cada um com seu próprio período (fim exclusivo).
const isDate = (s: unknown) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const nextDay = (d: string) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10); };

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const b = await req.json().catch(() => ({}));
    if (![b.orc_start, b.orc_end, b.loc_start, b.loc_end].every(isDate)) {
      return Response.json({ success: false, error: 'Períodos inválidos.' }, { status: 400 });
    }

    // No Sisloc, orçamentos e locações vivem em fich_loc: tp_ope_pedido 'O' = orçamento, 'L' = locação.
    const sqlFor = (tp: string, s: string, e: string) => `SELECT cd_empresa, cd_pessoa, COUNT(*) AS qtd, MAX(dt_pedido) AS ultimo
      FROM fich_loc WITH (NOLOCK)
      WHERE tp_ope_pedido = '${tp}' AND dt_pedido >= '${s}' AND dt_pedido < '${nextDay(e)}'
        AND cd_pessoa IS NOT NULL
        ${empFilter()}
      GROUP BY cd_empresa, cd_pessoa`;
    const orcSql = sqlFor('O', b.orc_start, b.orc_end);
    const locSql = sqlFor('L', b.loc_start, b.loc_end);

    let source: Record<string, unknown> = { credential_reference: 'env' };
    if (b.source_id) source = await base44.asServiceRole.entities.ErpDataSource.get(b.source_id);
    const rs = (r: any) => (Array.isArray(r?.recordset) ? r.recordset : []);
    const day = (v: unknown) => (v ? new Date(v as string).toISOString().slice(0, 10) : null);
    const map = (r: any) => ({ cd_empresa: Number(r.cd_empresa) || 0, cd_pessoa: String(r.cd_pessoa).trim(), qtd: Number(r.qtd) || 0, ultimo: day(r.ultimo) });

    const orcamentos = rs(await execRead(source, orcSql, 90000)).map(map);
    const locacoes = rs(await execRead(source, locSql, 90000)).map(map);
    return Response.json({ success: true, orcamentos, locacoes });
  } catch (error) {
    return Response.json({ success: false, error: (error as Error)?.message || String(error) }, { status: 500 });
  }
}