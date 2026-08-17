import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { execRead } from '../../shared/erpConnection.ts';
import { getTotvsLayout, buildTotvsSql, buildTotvsCountSql } from '../../shared/totvsMigration.ts';

// Saneamento CAR/CAP no layout TOTVS (SE1/SE2), separados e paginados.
// Modos: 'layout' (colunas) · 'count' (total + pendências) · 'page' (dados).
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const doc = body?.doc === 'cap' ? 'cap' : 'car';
    const mode = body?.mode || 'page';

    if (mode === 'layout') {
      return Response.json({ success: true, ...getTotvsLayout(doc) });
    }

    const startDate = String(body?.start_date || '2013-01-01');
    const endDate = String(body?.end_date || new Date().toISOString().slice(0, 10));

    const sql = mode === 'count'
      ? buildTotvsCountSql({ doc, startDate, endDate })
      : buildTotvsSql({ doc, startDate, endDate, offset: body?.offset, pageSize: body?.page_size });

    let source: Record<string, unknown> = { credential_reference: 'env' };
    if (body?.source_id) {
      source = await base44.asServiceRole.entities.ErpDataSource.get(body.source_id);
      if (!source) return Response.json({ success: false, error: 'Fonte de dados não encontrada.' }, { status: 404 });
    }

    const t0 = Date.now();
    const result = await execRead(source, sql, 120000);
    let rows: unknown[] = [];
    if (Array.isArray(result?.recordset) && result.recordset.length > 0) {
      rows = result.recordset;
    } else if (Array.isArray(result?.recordsets)) {
      for (let i = result.recordsets.length - 1; i >= 0; i--) {
        const rs = result.recordsets[i];
        if (Array.isArray(rs) && rs.length > 0) { rows = rs; break; }
      }
    }

    if (mode === 'count') {
      return Response.json({ success: true, doc, summary: rows[0] || {}, duration_ms: Date.now() - t0, sql });
    }

    return Response.json({
      success: true,
      doc,
      rows,
      total: rows.length,
      offset: Number(body?.offset) || 0,
      duration_ms: Date.now() - t0,
    });
  } catch (error) {
    return Response.json({ success: false, error: (error as Error)?.message || String(error) }, { status: 500 });
  }
}