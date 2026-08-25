import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { execRead } from '../../shared/erpConnection.ts';
import { getCatalog, buildExportSql } from '../../shared/finExportCatalog.ts';
import { resolvePeriod } from '../../shared/periodContract.ts';

// Exportação de CAP / CAR com filtros e seleção de colunas (whitelist do catálogo).
// Modos: { mode: 'columns', doc } → catálogo de colunas · demais → extração.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const doc = body?.doc === 'cap' ? 'cap' : 'car';

    if (body?.mode === 'columns') {
      return Response.json({ success: true, doc, catalog: getCatalog(doc) });
    }

    const resolvedPeriod = resolvePeriod({
      start: body?.start_date,
      endInclusive: body?.end_date,
      endExclusive: body?.end_date_exclusive,
      defaultStart: `${new Date().getFullYear()}-01-01`,
      defaultEndInclusive: new Date().toISOString().slice(0, 10),
    });

    const sql = buildExportSql({
      doc,
      columns: Array.isArray(body?.columns) ? body.columns : [],
      startDate: resolvedPeriod.start,
      endDateExclusive: resolvedPeriod.endExclusive,
      status: String(body?.status || 'todos'),
      cdEmpresa: body?.cd_empresa,
      limit: body?.limit,
    });

    let source: Record<string, unknown> = { credential_reference: 'env' };
    if (body?.source_id) {
      source = await base44.asServiceRole.entities.ErpDataSource.get(body.source_id);
      if (!source) return Response.json({ success: false, error: 'Fonte de dados não encontrada.' }, { status: 404 });
    }

    const t0 = Date.now();
    const result = await execRead(source, sql, 60000);
    let rows: unknown[] = [];
    if (Array.isArray(result?.recordset) && result.recordset.length > 0) {
      rows = result.recordset;
    } else if (Array.isArray(result?.recordsets)) {
      for (let i = result.recordsets.length - 1; i >= 0; i--) {
        const rs = result.recordsets[i];
        if (Array.isArray(rs) && rs.length > 0) { rows = rs; break; }
      }
    }

    return Response.json({
      success: true,
      doc,
      rows,
      total: rows.length,
      period: { start: resolvedPeriod.start, end: resolvedPeriod.endInclusive, end_exclusive: resolvedPeriod.endExclusive },
      duration_ms: Date.now() - t0,
      queries: [{ label: `Exportação ${doc.toUpperCase()}`, sql }],
    });
  } catch (error) {
    return Response.json({ success: false, error: (error as Error)?.message || String(error) }, { status: 500 });
  }
}