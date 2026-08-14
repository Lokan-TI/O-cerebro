import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { execRead } from '../../shared/erpConnection.ts';
import {
  LIFECYCLE_VERSION, buildLifecycleSql, classifyLifecycle, V1_FAMILIES, LEGACY_FAMILIES,
} from '../../shared/customerLifecycle.ts';
import {
  deriveLegacyContext, buildLegacyRemessaSql, buildLegacyFichaSql, classifyLegacy,
} from '../../shared/legacyClientStatus.ts';

// Doc 10, passo 2 da migração: reconciliação POR CLIENTE entre o lifecycle v1 (NF)
// e o motor legado (remessa). Produz matriz de confusão por família, taxa de
// concordância e as maiores divergências por receita.
const FAMILIES = ['ativo', 'risco', 'churn', 'pre_venda'];

function minusDays(dateStr: string, days: number) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

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

    let asOf = String(body?.as_of_date || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) {
      const snaps = await base44.asServiceRole.entities.ErpSnapshot.filter({ source_id: source.id, is_current: true });
      asOf = String(snaps?.[0]?.max_date || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) {
        return Response.json({ error: 'as_of_date é obrigatório (sem snapshot vigente para derivar).' }, { status: 400 });
      }
    }

    // 1. Lifecycle v1 (NF) por cliente
    const v1Sql = buildLifecycleSql(asOf);
    const v1Res = await execRead(source, v1Sql, 90000);
    const v1: Record<string, { status: string; rev: number; last: string | null }> = {};
    for (const r of v1Res.recordset || []) {
      v1[String(r.cd_pessoa)] = {
        status: classifyLifecycle(r),
        rev: Number(r.rev_12m) || 0,
        last: r.last_nf ? new Date(r.last_nf).toISOString().slice(0, 10) : null,
      };
    }

    // 2. Motor legado (remessa) por cliente, nas mesmas janelas do corte
    const ctx = deriveLegacyContext(minusDays(asOf, 365), asOf, minusDays(asOf, 730));
    const remessaSql = buildLegacyRemessaSql(ctx);
    const fichaSql = buildLegacyFichaSql(ctx);
    const legacyAgg: Record<string, any> = {};
    for (const r of (await execRead(source, remessaSql, 90000)).recordset || []) {
      legacyAgg[String(r.cd_pessoa)] = {
        has_remessa: true, first_remessa: r.first_remessa, last_remessa: r.last_remessa,
        cnt_a: Number(r.cnt_a) || 0, cnt_r: Number(r.cnt_r) || 0,
      };
    }
    for (const r of (await execRead(source, fichaSql, 60000)).recordset || []) {
      const code = String(r.cd_pessoa);
      if (!legacyAgg[code]) legacyAgg[code] = { has_remessa: false, min_ficha: r.min_ficha };
    }
    const legacy: Record<string, string> = {};
    for (const [code, c] of Object.entries(legacyAgg)) legacy[code] = classifyLegacy(c, ctx);

    // 3. Matriz de confusão por família + divergências
    const matrix: Record<string, Record<string, number>> = {};
    for (const a of FAMILIES) { matrix[a] = {}; for (const b of FAMILIES) matrix[a][b] = 0; }
    let both = 0, agree = 0, onlyV1 = 0, onlyLegacy = 0;
    const divergences = [];
    for (const [code, c] of Object.entries(v1)) {
      const famA = V1_FAMILIES[c.status];
      const legStatus = legacy[code];
      if (!legStatus) { onlyV1++; continue; }
      const famB = LEGACY_FAMILIES[legStatus] || 'pre_venda';
      both++;
      matrix[famA][famB]++;
      if (famA === famB) agree++;
      else divergences.push({
        cd_pessoa: code, v1_status: c.status, v1_family: famA,
        legacy_status: legStatus, legacy_family: famB,
        revenue_12m: c.rev, last_nf: c.last,
      });
    }
    for (const code of Object.keys(legacy)) if (!v1[code]) onlyLegacy++;

    const top = divergences.sort((a, b) => b.revenue_12m - a.revenue_12m).slice(0, 50);
    const codes = top.map((d) => d.cd_pessoa).filter((c) => /^\d+$/.test(c));
    if (codes.length) {
      try {
        const nres = await execRead(source, `SELECT cd_pessoa, COALESCE(NULLIF(nm_fan_pessoa,''), nm_pessoa) AS nome FROM pessoa WITH (NOLOCK) WHERE cd_pessoa IN (${codes.join(',')})`, 30000);
        const names: Record<string, string> = {};
        for (const r of nres.recordset || []) names[String(r.cd_pessoa)] = String(r.nome || '');
        for (const d of top) d.nm_pessoa = names[d.cd_pessoa] || `Cliente ${d.cd_pessoa}`;
      } catch { /* nomes são opcionais */ }
    }

    return Response.json({
      lifecycle_version: LIFECYCLE_VERSION,
      as_of_date: asOf,
      source: { id: source.id, name: source.name },
      windows: { analysis_start: ctx.aStart, analysis_end: ctx.aEnd, ref_start: ctx.rStart },
      families: FAMILIES,
      matrix,
      summary: {
        v1_clients: Object.keys(v1).length,
        legacy_clients: Object.keys(legacy).length,
        matched: both,
        agree,
        diverge: both - agree,
        agreement_pct: both ? Number(((agree / both) * 100).toFixed(1)) : 0,
        only_v1: onlyV1,
        only_legacy: onlyLegacy,
        divergence_revenue_12m: divergences.reduce((s, d) => s + d.revenue_12m, 0),
      },
      top_divergences: top,
      queries: [v1Sql, remessaSql, fichaSql],
      duration_ms: Date.now() - started,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}