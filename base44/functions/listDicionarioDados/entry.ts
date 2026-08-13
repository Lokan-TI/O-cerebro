import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { buildConfig, runQuery, closePool } from '../../shared/erpConnection.ts';

// Dicionário de dados oficial do Sisloc (view v_Dicionario_Dados).
// Modos:
//   sem parâmetros      -> lista de tabelas com contagem de campos e FKs
//   { table: 'car' }    -> todos os campos daquela tabela
//   { search: 'pessoa' } -> busca global por nome de campo / descrição (TOP 300)

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

const sanitize = (v: string) => String(v || '').replace(/[^A-Za-z0-9_ ]/g, '').slice(0, 60);

Deno.serve(async (req) => {
  let source: any = { credential_reference: 'env' };
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const sourceId = body?.source_id;
    if (sourceId) {
      source = await base44.asServiceRole.entities.ErpDataSource.get(sourceId);
      if (!source) return Response.json({ success: false, error: 'Fonte de dados não encontrada.' }, { status: 404 });
    }

    const config = buildConfig(source);
    if (!config) throw new Error('Configuração de conexão incompleta para a fonte.');
    const wrap = (inner: string) => config.clientId
      ? `EXEC DW_API '${config.clientId}', '${inner.replace(/'/g, "''")}'`
      : inner;

    const table = sanitize(body?.table);
    const search = sanitize(body?.search);
    const t0 = Date.now();

    let mode = 'tables';
    let sql = '';

    if (table) {
      mode = 'columns';
      sql = `SELECT Tabela, Coluna, Caption, Options, Tipo, Tam_Maximo, Nulo, Chave_estrangeira
        FROM v_Dicionario_Dados
        WHERE Tabela = '${table}' AND Coluna <> ''
        ORDER BY Coluna`;
    } else if (search) {
      mode = 'search';
      sql = `SELECT TOP 300 Tabela, Coluna, Caption, Options, Tipo, Tam_Maximo, Nulo, Chave_estrangeira
        FROM v_Dicionario_Dados
        WHERE Coluna <> '' AND (Coluna LIKE '%${search}%' OR Caption LIKE '%${search}%' OR Tabela LIKE '%${search}%')
        ORDER BY Tabela, Coluna`;
    } else {
      sql = `SELECT Tabela,
          COUNT(*) AS campos,
          SUM(CASE WHEN Chave_estrangeira <> '' THEN 1 ELSE 0 END) AS fks,
          SUM(CASE WHEN Options <> '' THEN 1 ELSE 0 END) AS dominios,
          SUM(CASE WHEN Caption <> '' THEN 1 ELSE 0 END) AS descritos
        FROM v_Dicionario_Dados
        WHERE Coluna <> ''
        GROUP BY Tabela
        ORDER BY Tabela`;
    }

    const rows = getRows(await runQuery(source, wrap(sql), 60000));

    const items = rows.map((r: any) => ({
      tabela: String(r.Tabela || ''),
      coluna: r.Coluna !== undefined ? String(r.Coluna || '') : undefined,
      caption: r.Caption !== undefined ? String(r.Caption || '') : undefined,
      options: r.Options !== undefined ? String(r.Options || '') : undefined,
      tipo: r.Tipo !== undefined ? String(r.Tipo || '') : undefined,
      tamanho: r.Tam_Maximo !== undefined ? Number(r.Tam_Maximo) || 0 : undefined,
      nulo: r.Nulo !== undefined ? String(r.Nulo || '') : undefined,
      fk: r.Chave_estrangeira !== undefined ? String(r.Chave_estrangeira || '') : undefined,
      campos: r.campos !== undefined ? Number(r.campos) || 0 : undefined,
      fks: r.fks !== undefined ? Number(r.fks) || 0 : undefined,
      dominios: r.dominios !== undefined ? Number(r.dominios) || 0 : undefined,
      descritos: r.descritos !== undefined ? Number(r.descritos) || 0 : undefined,
    }));

    return Response.json({
      success: true,
      mode,
      table: table || null,
      search: search || null,
      items,
      total: items.length,
      duration_ms: Date.now() - t0,
      queries: [
        {
          label: mode === 'columns' ? `Campos da tabela ${table}` : mode === 'search' ? 'Busca no dicionário' : 'Tabelas do dicionário',
          description: 'v_Dicionario_Dados — dicionário de dados oficial do Sisloc',
          sql,
        },
      ],
    });
  } catch (error) {
    try { await closePool(source); } catch {}
    return Response.json({ success: false, error: (error as Error).message || String(error) }, { status: 500 });
  }
});