import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { buildConfig, runQuery, closePool } from '../../shared/erpConnection.ts';
import { classifyDomain, classifySemanticType, isPii, isCoreTable } from './classify.ts';

// Fase 3 — Extended Property Discovery.
// Extrai o dicionário completo (v_Dicionario_Dados) e repopula MetadataCatalog.

function getRows(result: any) {
  if (!result) return [];
  if (Array.isArray(result.recordset) && result.recordset.length > 0) return result.recordset;
  if (Array.isArray(result.recordsets)) {
    for (let i = result.recordsets.length - 1; i >= 0; i--) {
      if (Array.isArray(result.recordsets[i]) && result.recordsets[i].length > 0) return result.recordsets[i];
    }
  }
  if (Array.isArray(result)) return result;
  return [];
}

Deno.serve(async (req) => {
  let source: any = { credential_reference: 'env' };
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    if (body?.source_id) {
      source = await base44.asServiceRole.entities.ErpDataSource.get(body.source_id);
      if (!source) return Response.json({ success: false, error: 'Fonte de dados não encontrada.' }, { status: 404 });
    }

    const config = buildConfig(source);
    if (!config) throw new Error('Configuração de conexão incompleta para a fonte.');

    const t0 = Date.now();
    const sql = `SELECT Tabela, Coluna, Caption, Tipo, Chave_estrangeira
      FROM v_Dicionario_Dados
      WHERE Coluna <> ''
      ORDER BY Tabela, Coluna`;
    const wrapped = config.clientId
      ? `EXEC DW_API '${config.clientId}', '${sql.replace(/'/g, "''")}'`
      : sql;

    const rows = getRows(await runQuery(source, wrapped, 90000));
    if (rows.length === 0) throw new Error('v_Dicionario_Dados não retornou colunas.');

    const now = new Date().toISOString();
    const ordinals: Record<string, number> = {};
    const records = rows.map((r: any) => {
      const table = String(r.Tabela || '');
      const column = String(r.Coluna || '');
      ordinals[table] = (ordinals[table] || 0) + 1;
      return {
        system_id: 'LOKAN_ERP',
        table_name: table,
        column_name: column,
        ordinal_position: ordinals[table],
        caption: String(r.Caption || ''),
        data_type: String(r.Tipo || ''),
        foreign_key: String(r.Chave_estrangeira || ''),
        domain: classifyDomain(table),
        semantic_type: classifySemanticType(column),
        pii_flag: isPii(column),
        is_core_table: isCoreTable(table),
        last_discovered_at: now,
        validation_status: 'DISCOVERED',
      };
    });

    // Repopulação completa — evita duplicidade entre execuções.
    await base44.asServiceRole.entities.MetadataCatalog.deleteMany({ system_id: 'LOKAN_ERP' });

    let inserted = 0;
    for (let i = 0; i < records.length; i += 400) {
      const chunk = records.slice(i, i + 400);
      await base44.asServiceRole.entities.MetadataCatalog.bulkCreate(chunk);
      inserted += chunk.length;
    }

    const tables = new Set(records.map((r: any) => r.table_name));
    return Response.json({
      success: true,
      inserted,
      tables: tables.size,
      pii_columns: records.filter((r: any) => r.pii_flag).length,
      core_columns: records.filter((r: any) => r.is_core_table).length,
      last_discovered_at: now,
      duration_ms: Date.now() - t0,
      sql,
    });
  } catch (error) {
    try { await closePool(source); } catch {}
    return Response.json({ success: false, error: (error as Error).message || String(error) }, { status: 500 });
  }
});