import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { execRead } from '../../shared/erpConnection.ts';

// Contatos dos clientes (pessoa) + contato do último orçamento (O) e da última locação (L) em fich_loc.
const isDate = (s: unknown) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const nextDay = (d: string) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10); };
const t = (v: unknown) => String(v ?? '').trim();

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const b = await req.json().catch(() => ({}));
    if (![b.orc_start, b.orc_end, b.loc_start, b.loc_end].every(isDate)) {
      return Response.json({ success: false, error: 'Períodos inválidos.' }, { status: 400 });
    }
    const ids: string[] = (Array.isArray(b.ids) ? b.ids : []).map((x: unknown) => t(x).replace(/[^0-9A-Za-z]/g, '')).filter(Boolean);
    let source: Record<string, unknown> = { credential_reference: 'env' };
    if (b.source_id) source = await base44.asServiceRole.entities.ErpDataSource.get(b.source_id);
    const rs = (r: any) => (Array.isArray(r?.recordset) ? r.recordset : []);
    const out: Record<string, any> = {};

    for (let i = 0; i < ids.length; i += 500) {
      const inList = ids.slice(i, i + 500).map((x) => `'${x}'`).join(',');
      const pes = rs(await execRead(source, `SELECT cd_pessoa, en_mail_pessoa, tel_pessoa, tl_cel_pessoa FROM pessoa WITH (NOLOCK) WHERE cd_pessoa IN (${inList})`, 90000));
      pes.forEach((p: any) => { out[t(p.cd_pessoa)] = { email: t(p.en_mail_pessoa), telefone: t(p.tel_pessoa), celular: t(p.tl_cel_pessoa) }; });
      const lastSql = (tp: string, s: string, e: string) => `SELECT cd_pessoa, contato, telefone FROM (
          SELECT cd_pessoa, contato, telefone, ROW_NUMBER() OVER (PARTITION BY cd_pessoa ORDER BY dt_pedido DESC) AS rn
          FROM fich_loc WITH (NOLOCK)
          WHERE tp_ope_pedido = '${tp}' AND dt_pedido >= '${s}' AND dt_pedido < '${nextDay(e)}' AND cd_pessoa IN (${inList})
        ) x WHERE rn = 1`;
      for (const [tp, s, e, k] of [['O', b.orc_start, b.orc_end, 'orc'], ['L', b.loc_start, b.loc_end, 'loc']]) {
        rs(await execRead(source, lastSql(tp, s, e), 90000)).forEach((r: any) => {
          const c = (out[t(r.cd_pessoa)] ||= {});
          c[`${k}_contato`] = t(r.contato); c[`${k}_telefone`] = t(r.telefone);
        });
      }
    }
    return Response.json({ success: true, contatos: out });
  } catch (error) {
    return Response.json({ success: false, error: (error as Error)?.message || String(error) }, { status: 500 });
  }
}