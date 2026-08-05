import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { buildConfig, runQuery, closePool } from '../../shared/erpConnection.ts';
import { SISLOC_SCHEMA_VERSION, SISLOC_TABLES } from '../../shared/sislocSchema.ts';

// Validação automática da estrutura de uma fonte contra o Schema Canônico Sisloc.
// Classifica em: Compatível / Compatível com alertas / Incompatível.
// Incompatível → tabelas/colunas obrigatórias ausentes; não publica na camada analítica.
// Compatível com alertas → divergências não críticas (opcionais ausentes).
//
// Aceita source_id (fonte salva) ou source (config inline, para validar antes de salvar).

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') {
      return Response.json({ error: 'Apenas administradores podem validar a estrutura.' }, { status: 403 });
    }

    const body = await req.json();
    const sourceId = body?.source_id;
    let source = body?.source;
    if (sourceId) {
      source = await base44.asServiceRole.entities.ErpDataSource.get(sourceId);
      if (!source) return Response.json({ error: 'Fonte de dados não encontrada.' }, { status: 404 });
    }

    const built = buildConfig(source);
    if (!built) {
      return Response.json({
        success: false, classification: 'Incompatível',
        message: 'Configuração incompleta — verifique host, banco, usuário e senha.',
      });
    }

    const wrap = (inner) => built.clientId
      ? `EXEC DW_API '${built.clientId}', '${inner.replace(/'/g, "''")}'`
      : inner;

    const t0 = Date.now();

    // 1. Conectividade
    try {
      await runQuery(source, wrap('SELECT 1 AS ok'));
    } catch (err) {
      await closePool(source);
      return Response.json({
        success: false, classification: 'Incompatível',
        message: 'Não foi possível conectar ao servidor. Verifique host, porta, usuário e senha.',
        response_time_ms: Date.now() - t0,
      });
    }

    // 2. Estrutura — tabelas e colunas (TOP 1, sargable, sem INFORMATION_SCHEMA)
    const tableChecks = [];
    const columnChecks = [];
    const missingRequired = [];
    const missingOptional = [];

    for (const t of SISLOC_TABLES) {
      let tableExists = false;
      try {
        await runQuery(source, wrap(`SELECT TOP 1 1 AS ok FROM ${t.name}`));
        tableExists = true;
      } catch {
        tableExists = false;
      }
      tableChecks.push({
        name: t.name, exists: tableExists, required: t.required,
        target: t.target, layer: t.layer, purpose: t.purpose,
      });
      if (!tableExists) {
        (t.required ? missingRequired : missingOptional).push({ table: t.name, target: t.target, required: t.required });
        continue;
      }

      // Tentar todas as colunas de uma vez (caso comum: todas presentes → 1 query)
      const colNames = t.columns.map((c) => c.name).join(', ');
      let allPresent = false;
      try {
        await runQuery(source, wrap(`SELECT TOP 1 ${colNames} FROM ${t.name}`));
        allPresent = true;
      } catch {
        allPresent = false;
      }
      if (allPresent) {
        for (const c of t.columns) {
          columnChecks.push({ table: t.name, column: c.name, exists: true, required: c.required, purpose: c.purpose });
        }
      } else {
        // Fallback: checar coluna a coluna para identificar quais faltam
        for (const c of t.columns) {
          let colExists = false;
          try {
            await runQuery(source, wrap(`SELECT TOP 1 ${c.name} FROM ${t.name}`));
            colExists = true;
          } catch {
            colExists = false;
          }
          columnChecks.push({ table: t.name, column: c.name, exists: colExists, required: c.required, purpose: c.purpose });
          if (!colExists) {
            (c.required ? missingRequired : missingOptional).push({ table: t.name, column: c.name, required: c.required });
          }
        }
      }
    }

    // 3. Classificação
    let classification, message;
    if (missingRequired.length > 0) {
      classification = 'Incompatível';
      message = 'Estrutura Sisloc divergente — tabelas/colunas obrigatórias ausentes. A fonte não será publicada na camada analítica.';
    } else if (missingOptional.length > 0) {
      classification = 'Compatível com alertas';
      message = 'Estrutura Sisloc identificada com divergências não críticas. Integração permitida; alguns dashboards podem ter dados parciais.';
    } else {
      classification = 'Compatível';
      message = 'Estrutura Sisloc identificada. Todas as tabelas e campos obrigatórios estão disponíveis.';
    }

    return Response.json({
      success: true,
      schema_version: SISLOC_SCHEMA_VERSION,
      classification,
      message,
      response_time_ms: Date.now() - t0,
      table_checks: tableChecks,
      column_checks: columnChecks,
      missing_required: missingRequired,
      missing_optional: missingOptional,
      table_count: tableChecks.length,
      tables_found: tableChecks.filter((t) => t.exists).length,
    });
  } catch (error) {
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
});