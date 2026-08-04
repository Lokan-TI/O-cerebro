import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { buildConfig, runQuery, closePool } from '../../shared/erpConnection.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const query = body?.query;
    const sourceId = body?.source_id;

    if (!query || typeof query !== 'string') {
      return Response.json({ error: 'Parâmetro "query" é obrigatório' }, { status: 400 });
    }

    // Security: strip leading comments before validation
    let cleaned = query.trim();
    while (cleaned.startsWith('--')) {
      const newlineIdx = cleaned.indexOf('\n');
      if (newlineIdx === -1) { cleaned = ''; break; }
      cleaned = cleaned.slice(newlineIdx + 1).trim();
    }
    const trimmed = cleaned.toUpperCase();
    if (!trimmed.startsWith('SELECT') && !trimmed.startsWith('WITH')) {
      return Response.json({ error: 'Apenas queries SELECT ou WITH são permitidas (read-only)' }, { status: 403 });
    }

    // Resolve the data source. Default to the env-based (Matriz) connection when no source is selected.
    let source = null;
    if (sourceId) {
      source = await base44.asServiceRole.entities.ErpDataSource.get(sourceId);
      if (!source) {
        return Response.json({ error: 'Fonte de dados não encontrada.' }, { status: 404 });
      }
      if (source.is_active === false) {
        return Response.json({ error: 'A fonte selecionada está inativa.' }, { status: 403 });
      }
    } else {
      source = { credential_reference: 'env' };
    }

    const built = buildConfig(source);
    if (!built) {
      return Response.json({ error: 'Configuração de conexão incompleta para a fonte selecionada.' }, { status: 500 });
    }

    // Wrap in DW_API when a client id is configured (SISLOC wrapper), otherwise run the query directly.
    const escapedSql = cleaned.replace(/'/g, "''");
    const execSql = built.clientId ? `EXEC DW_API '${built.clientId}', '${escapedSql}'` : cleaned;

    const result = await runQuery(source, execSql);
    const rows = result.recordset || [];
    return Response.json({
      rows,
      rowCount: rows.length,
      multipleSets: result.recordsets || [],
    });
  } catch (error) {
    // Close the pool for the current source so the next request gets a fresh, clean connection.
    try {
      const body2 = await req.clone().json().catch(() => ({}));
      if (body2?.source_id) await closePool({ id: body2.source_id, credential_reference: 'entity' });
      else await closePool({ credential_reference: 'env' });
    } catch {}
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
});