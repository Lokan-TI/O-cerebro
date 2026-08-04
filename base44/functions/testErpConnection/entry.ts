import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { buildConfig, runQuery, closePool } from '../../shared/erpConnection.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') {
      return Response.json({ error: 'Apenas administradores podem testar conexões.' }, { status: 403 });
    }

    const body = await req.json();
    const sourceId = body?.source_id;
    let source = body?.source; // inline config for unsaved sources

    if (sourceId) {
      source = await base44.asServiceRole.entities.ErpDataSource.get(sourceId);
      if (!source) return Response.json({ error: 'Fonte de dados não encontrada.' }, { status: 404 });
    }

    const built = buildConfig(source);
    if (!built) {
      return Response.json({
        success: false,
        message: 'Configuração incompleta — verifique host, banco, usuário e senha.',
      });
    }

    // Wrap inner SQL in the DW_API procedure when a client id is configured (SISLOC),
    // otherwise run the query directly. Uses the shared, serialized pool to avoid
    // concurrent-pool crashes in the Deno worker.
    const wrap = (inner) => built.clientId
      ? `EXEC DW_API '${built.clientId}', '${inner.replace(/'/g, "''")}'`
      : inner;

    const t0 = Date.now();
    try {
      // 1. Basic connectivity + auth + database access + read permission
      await runQuery(source, wrap('SELECT 1 AS ok'));
      const responseTimeMs = Date.now() - t0;

      // 2. Essential tables
      const tables = ['pessoa', 'fich_loc'];
      const tableResults = {};
      for (const t of tables) {
        try {
          await runQuery(source, wrap(`SELECT TOP 1 1 AS ok FROM ${t}`));
          tableResults[t] = true;
        } catch {
          tableResults[t] = false;
        }
      }

      // 3. Essential columns
      const columnChecks = [
        { table: 'fich_loc', column: 'lookup_cd_pessoa' },
        { table: 'pessoa', column: 'nm_pessoa' },
        { table: 'pessoa', column: 'nr_cpf_pessoa' },
        { table: 'pessoa', column: 'dt_cad_pessoa' },
      ];
      const columnResults = {};
      for (const c of columnChecks) {
        try {
          await runQuery(source, wrap(`SELECT TOP 1 ${c.column} FROM ${c.table}`));
          columnResults[`${c.table}.${c.column}`] = true;
        } catch {
          columnResults[`${c.table}.${c.column}`] = false;
        }
      }

      const allTablesFound = Object.values(tableResults).every((v) => v === true);
      const allColumnsFound = Object.values(columnResults).every((v) => v === true);

      let message;
      if (allTablesFound && allColumnsFound) {
        message = 'Conexão realizada com sucesso. O banco foi acessado e as tabelas principais foram encontradas.';
      } else if (allTablesFound) {
        message = 'Conexão realizada, mas algumas colunas essenciais não foram encontradas. Mapeamento pode ser necessário.';
      } else {
        const missing = tables.filter((t) => !tableResults[t]);
        message = `Foi possível acessar o servidor, mas a tabela ${missing[0]} não foi encontrada nessa base.`;
      }

      return Response.json({
        success: allTablesFound,
        compatible: allTablesFound && allColumnsFound,
        responseTimeMs,
        tables: tableResults,
        columns: columnResults,
        message,
      });
    } catch (err) {
      await closePool(source);
      return Response.json({
        success: false,
        message: 'Não foi possível conectar ao servidor. Verifique host, porta, usuário e senha.',
        responseTimeMs: Date.now() - t0,
      });
    }
  } catch (error) {
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
});