import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { buildConfig, runQuery, closePool } from '../../shared/erpConnection.ts';
import { assertReadOnlyQuery, SqlGuardError, MAX_ROWS_RETURNED } from '../../shared/sqlGuard.ts';

// Administrative ad-hoc query endpoint.
// P0-02: restricted to admins, single read-only statement, row-capped and fully audited.
Deno.serve(async (req) => {
  const started = Date.now();
  let base44: any = null;
  let user: any = null;
  let source: any = null;
  let sourceId: string | null = null;
  let cleaned = '';

  const audit = async (fields: Record<string, unknown>) => {
    try {
      await base44?.asServiceRole.entities.ErpQueryAudit.create({
        user_id: user?.id || null,
        user_email: user?.email || null,
        user_role: user?.role || null,
        source_id: sourceId,
        source_name: source?.name || null,
        query: cleaned || '(não avaliada)',
        executed_at: new Date().toISOString(),
        duration_ms: Date.now() - started,
        ...fields,
      });
    } catch (e) {
      console.error('Falha ao registrar auditoria de query:', e?.message || e, JSON.stringify(e?.response?.data || null));
    }
  };

  try {
    base44 = createClientFromRequest(req);
    user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    if (user.role !== 'admin') {
      await audit({ outcome: 'blocked', block_reason: 'Perfil sem permissão para consulta ad-hoc' });
      return Response.json(
        { error: 'Consulta SQL ad-hoc é restrita a administradores de dados.' },
        { status: 403 },
      );
    }

    const body = await req.json();
    sourceId = body?.source_id || null;

    try {
      cleaned = assertReadOnlyQuery(body?.query);
    } catch (e) {
      const err = e as SqlGuardError;
      cleaned = typeof body?.query === 'string' ? body.query.slice(0, 4000) : '';
      await audit({ outcome: 'blocked', block_reason: err.message });
      return Response.json({ error: err.message }, { status: err.status || 403 });
    }

    // Resolve the data source. Default to the env-based (Matriz) connection when none is selected.
    if (sourceId) {
      source = await base44.asServiceRole.entities.ErpDataSource.get(sourceId);
      if (!source) {
        await audit({ outcome: 'blocked', block_reason: 'Fonte não encontrada' });
        return Response.json({ error: 'Fonte de dados não encontrada.' }, { status: 404 });
      }
      if (source.is_active === false) {
        await audit({ outcome: 'blocked', block_reason: 'Fonte inativa' });
        return Response.json({ error: 'A fonte selecionada está inativa.' }, { status: 403 });
      }
    } else {
      source = { credential_reference: 'env' };
    }

    const built = buildConfig(source);
    if (!built) {
      await audit({ outcome: 'error', block_reason: 'Configuração de conexão incompleta' });
      return Response.json(
        { error: 'Configuração de conexão incompleta para a fonte selecionada.' },
        { status: 500 },
      );
    }

    // Wrap in DW_API when a client id is configured (SISLOC wrapper), otherwise run directly.
    const escapedSql = cleaned.replace(/'/g, "''");
    const execSql = built.clientId ? `EXEC DW_API '${built.clientId}', '${escapedSql}'` : cleaned;

    const result = await runQuery(source, execSql);
    const all = result.recordset || [];
    const truncated = all.length > MAX_ROWS_RETURNED;
    const rows = truncated ? all.slice(0, MAX_ROWS_RETURNED) : all;

    await audit({ outcome: 'allowed', row_count: rows.length, truncated });

    return Response.json({
      rows,
      rowCount: rows.length,
      totalRowCount: all.length,
      truncated,
      maxRows: MAX_ROWS_RETURNED,
      multipleSets: result.recordsets || [],
    });
  } catch (error) {
    await audit({ outcome: 'error', block_reason: error.message || String(error) });
    // Close the pool for the current source so the next request gets a fresh connection.
    try {
      if (sourceId) await closePool({ id: sourceId, credential_reference: 'entity' });
      else await closePool({ credential_reference: 'env' });
    } catch {}
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
});