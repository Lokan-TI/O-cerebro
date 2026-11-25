import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { canView, scopedEmpresa } from '../../shared/access.ts';
import { execRead } from '../../shared/erpConnection.ts';
import { resolvePeriod } from '../../shared/periodContract.ts';
import { empFilter } from '../../shared/empresaScope.ts';
import { fichaStatusSql } from '../../shared/fichaLifecycle.ts';

// Fichas de locação (uma linha por ficha) com o status da tela do Sisloc, o cliente e os contatos.
// Inclui clientes sem faturamento. Período = data do pedido. Paginação keyset por cd_controle.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!canView(user)) return Response.json({ success: false, error: 'Acesso restrito.' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const period = resolvePeriod({
      start: body?.start_date,
      endInclusive: body?.end_date,
      endExclusive: body?.end_date_exclusive,
      defaultStart: '2000-01-01',
      defaultEndInclusive: new Date().toISOString().slice(0, 10),
    });
    const after = Math.max(0, Number(body?.after) || 0);
    const limit = Math.min(5000, Math.max(100, Number(body?.limit) || 5000));
    const empRaw = scopedEmpresa(user, body?.cd_empresa);
    const emp = empRaw != null && empRaw !== '' ? Number(empRaw) : null;
    if (emp != null && !Number.isInteger(emp)) return Response.json({ success: false, error: 'cd_empresa inválido.' }, { status: 400 });

    let source: Record<string, unknown> = { credential_reference: 'env' };
    if (body?.source_id) {
      source = await base44.asServiceRole.entities.ErpDataSource.get(body.source_id).catch((e) => (e.status === 404 ? null : Promise.reject(e)));
      if (!source) return Response.json({ success: false, error: 'Fonte de dados não encontrada.' }, { status: 404 });
    }

    const sql = `SELECT TOP ${limit}
        f.cd_controle, f.numero, f.cd_empresa,
        COALESCE(NULLIF(LTRIM(RTRIM(e.nm_fan_empresa)), ''), CONCAT('Empresa ', f.cd_empresa)) AS nm_empresa,
        ${fichaStatusSql('f')} AS status,
        f.dt_pedido, f.dt_validade, f.dt_enc_ficha, f.cd_pessoa,
        COALESCE(NULLIF(LTRIM(RTRIM(p.nm_pessoa)), ''), NULLIF(LTRIM(RTRIM(p.nm_fan_pessoa)), ''), CONCAT('Cliente ', f.cd_pessoa)) AS nm_pessoa,
        f.contato, f.telefone, CAST(f.email_contato AS varchar(300)) AS email_contato,
        p.en_mail_pessoa AS email, p.tel_pessoa AS tel_cadastro, p.tl_cel_pessoa AS cel_cadastro
      FROM fich_loc f WITH (NOLOCK)
      LEFT JOIN pessoa p WITH (NOLOCK) ON p.cd_pessoa = f.cd_pessoa
      LEFT JOIN empresa e WITH (NOLOCK) ON e.cd_empresa = f.cd_empresa
      WHERE f.cd_controle > ${after}
        AND f.dt_pedido >= '${period.start}' AND f.dt_pedido < '${period.endExclusive}'
        ${emp != null ? `AND f.cd_empresa = ${emp}` : ''}
        ${empFilter('f')}
      ORDER BY f.cd_controle`;

    const res: any = await execRead(source, sql, 85000);
    const day = (v: unknown) => (v ? new Date(v as string).toISOString().slice(0, 10) : null);
    const t = (v: unknown) => String(v ?? '').trim();
    const rows = (Array.isArray(res?.recordset) ? res.recordset : []).map((r: any) => ({
      cd_controle: Number(r.cd_controle),
      numero: r.numero,
      cd_empresa: Number(r.cd_empresa) || 0,
      nm_empresa: t(r.nm_empresa),
      status: t(r.status),
      dt_pedido: day(r.dt_pedido),
      dt_validade: day(r.dt_validade),
      dt_enc_ficha: day(r.dt_enc_ficha),
      cd_pessoa: t(r.cd_pessoa),
      nm_pessoa: t(r.nm_pessoa),
      contato: t(r.contato),
      telefone: t(r.telefone),
      email_contato: t(r.email_contato),
      email: t(r.email),
      tel_cadastro: t(r.tel_cadastro),
      cel_cadastro: t(r.cel_cadastro),
    }));

    return Response.json({
      success: true,
      rows,
      next_after: rows.length ? rows[rows.length - 1].cd_controle : after,
      has_more: rows.length === limit,
      period: { start: period.start, end: period.endInclusive },
    });
  } catch (error) {
    return Response.json({ success: false, error: (error as Error)?.message || String(error) }, { status: 500 });
  }
}