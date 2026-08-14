import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { execRead } from '../../shared/erpConnection.ts';
import {
  LIFECYCLE_VERSION, LIFECYCLE_STATUSES, buildLifecycleSql, classifyLifecycle,
} from '../../shared/customerLifecycle.ts';

// Serviço único do Customer Lifecycle v1 (doc 10, passo 1 da migração):
// classifica o universo de clientes com NF na data de corte explícita, sem alterar telas.
export default async function (req: Request): Promise<Response> {
  const started = Date.now();
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Apenas administradores.' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    let source = null;
    if (body?.source_id) {
      source = await base44.asServiceRole.entities.ErpDataSource.get(body.source_id);
    } else {
      const list = await base44.asServiceRole.entities.ErpDataSource.filter({ credential_reference: 'env' });
      source = list?.[0] || null;
    }
    if (!source) return Response.json({ error: 'Fonte de dados não encontrada.' }, { status: 404 });

    // as_of_date explícito; sem ele, usa a data máxima do snapshot vigente (nunca "hoje" implícito).
    let asOf = String(body?.as_of_date || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) {
      const snaps = await base44.asServiceRole.entities.ErpSnapshot.filter({ source_id: source.id, is_current: true });
      asOf = String(snaps?.[0]?.max_date || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) {
        return Response.json({ error: 'as_of_date é obrigatório (sem snapshot vigente para derivar).' }, { status: 400 });
      }
    }

    const sql = buildLifecycleSql(asOf);
    const res = await execRead(source, sql, 90000);
    const rows = res.recordset || [];

    const distribution: Record<string, { count: number; revenue_12m: number }> = {};
    for (const s of LIFECYCLE_STATUSES) distribution[s] = { count: 0, revenue_12m: 0 };
    const clients = [];
    for (const r of rows) {
      const status = classifyLifecycle(r);
      const rev = Number(r.rev_12m) || 0;
      distribution[status].count++;
      distribution[status].revenue_12m += rev;
      clients.push({
        cd_pessoa: String(r.cd_pessoa),
        status,
        last_activity_date: r.last_nf ? new Date(r.last_nf).toISOString().slice(0, 10) : null,
        first_activity_date: r.first_nf ? new Date(r.first_nf).toISOString().slice(0, 10) : null,
        activity_count_12m: (Number(r.cnt_0_90) || 0) + (Number(r.cnt_91_180) || 0) + (Number(r.cnt_181_365) || 0),
        revenue_12m: rev,
      });
    }

    // Top 100 por receita 12m, com nomes resolvidos em lote
    const top = clients.sort((a, b) => b.revenue_12m - a.revenue_12m).slice(0, 100);
    const codes = top.map((c) => c.cd_pessoa).filter((c) => /^\d+$/.test(c));
    if (codes.length) {
      try {
        const nres = await execRead(source, `SELECT cd_pessoa, COALESCE(NULLIF(nm_fan_pessoa,''), nm_pessoa) AS nome FROM pessoa WITH (NOLOCK) WHERE cd_pessoa IN (${codes.join(',')})`, 30000);
        const names: Record<string, string> = {};
        for (const r of nres.recordset || []) names[String(r.cd_pessoa)] = String(r.nome || '');
        for (const c of top) c.nm_pessoa = names[c.cd_pessoa] || `Cliente ${c.cd_pessoa}`;
      } catch { /* nomes são opcionais */ }
    }

    return Response.json({
      lifecycle_version: LIFECYCLE_VERSION,
      as_of_date: asOf,
      universe: 'clientes com ≥1 NF de saída válida com valor > 0 (mesmo universo de MTR-001)',
      source: { id: source.id, name: source.name },
      total_clients: clients.length,
      distribution: LIFECYCLE_STATUSES.map((s) => ({ status: s, ...distribution[s] })),
      top_clients: top,
      queries: [sql],
      duration_ms: Date.now() - started,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}