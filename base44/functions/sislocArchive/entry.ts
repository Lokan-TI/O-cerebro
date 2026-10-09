import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { buildConfig, runQuery, closePool } from '../../shared/erpConnection.ts';

const rowsOf = (r: any) => r?.recordset || [];
const q = (s: string) => `[${String(s).replace(/]/g, ']]')}]`;

function serialize(v: any) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v.toISOString();
  if (v instanceof Uint8Array) return { __b64: btoa(String.fromCharCode(...v)) };
  if (typeof v === 'bigint') return v.toString();
  return v;
}

async function loadSource(base44: any, sourceId?: string) {
  if (!sourceId) return { credential_reference: 'env', name: 'Matriz (env)' };
  const s = await base44.asServiceRole.entities.ErpDataSource.get(sourceId);
  if (!s) throw new Error('Fonte não encontrada.');
  return s;
}

async function countRows(source: any, wrap: any, t: any) {
  const r = await runQuery(source, wrap(`SELECT COUNT_BIG(*) AS n FROM ${q(t.schema_name)}.${q(t.table_name)} WITH (NOLOCK)`), 120000);
  return Number(rowsOf(r)[0]?.n || 0);
}

export default async function (req: Request): Promise<Response> {
  let source: any = null;
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Acesso restrito a administradores.' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { action } = body;
    const E = base44.asServiceRole.entities;

    let table: any = null;
    let run: any = null;
    if (body.table_id) {
      table = await E.SislocArchiveTable.get(body.table_id);
      run = await E.SislocArchiveRun.get(table.run_id);
    }
    source = await loadSource(base44, action === 'inventory' ? body.source_id : run?.source_id);
    const built = buildConfig(source);
    if (!built) throw new Error('Configuração de conexão incompleta.');
    const wrap = (s: string) => built.clientId ? `EXEC DW_API '${built.clientId}', '${s.replace(/'/g, "''")}'` : s;

    if (action === 'inventory') {
      const tabs = rowsOf(await runQuery(source, wrap(`SELECT t.object_id, s.name AS schema_name, t.name AS table_name,
        (SELECT SUM(p.rows) FROM sys.partitions p WHERE p.object_id = t.object_id AND p.index_id IN (0,1)) AS row_count
        FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id WHERE t.is_ms_shipped = 0`), 120000));
      const cols = rowsOf(await runQuery(source, wrap(`SELECT c.object_id, c.name, ty.name AS type, c.max_length, c.precision, c.scale, c.is_nullable, c.column_id
        FROM sys.columns c JOIN sys.types ty ON ty.user_type_id = c.user_type_id
        JOIN sys.tables t ON t.object_id = c.object_id WHERE t.is_ms_shipped = 0`), 120000));
      const pks = rowsOf(await runQuery(source, wrap(`SELECT ic.object_id, c.name, ic.key_ordinal FROM sys.indexes i
        JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
        JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id WHERE i.is_primary_key = 1`), 120000));
      const fks = rowsOf(await runQuery(source, wrap(`SELECT fkc.parent_object_id AS object_id, fk.name AS fk_name,
        pc.name AS column_name, OBJECT_NAME(fkc.referenced_object_id) AS ref_table, rc.name AS ref_column
        FROM sys.foreign_key_columns fkc JOIN sys.foreign_keys fk ON fk.object_id = fkc.constraint_object_id
        JOIN sys.columns pc ON pc.object_id = fkc.parent_object_id AND pc.column_id = fkc.parent_column_id
        JOIN sys.columns rc ON rc.object_id = fkc.referenced_object_id AND rc.column_id = fkc.referenced_column_id`), 120000));

      const group = (arr: any[]) => arr.reduce((m: any, r: any) => ((m[r.object_id] ||= []).push(r), m), {});
      const colsBy = group(cols), pkBy = group(pks), fkBy = group(fks);
      const limitations: string[] = [];
      const version = `SISLOC-${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')}`;
      let total = 0;
      const tableRecords = tabs.map((t: any) => {
        const c = (colsBy[t.object_id] || []).sort((a: any, b: any) => a.column_id - b.column_id);
        const pk = (pkBy[t.object_id] || []).sort((a: any, b: any) => a.key_ordinal - b.key_ordinal).map((p: any) => p.name);
        const orderable = c.filter((x: any) => !['text', 'ntext', 'image', 'xml', 'geography', 'geometry', 'sql_variant'].includes(x.type)).map((x: any) => x.name);
        const stable = pk.length > 0;
        if (!stable) limitations.push(`${t.table_name}: sem chave primária — paginação ordenada por todas as colunas comparáveis.`);
        total += Number(t.row_count || 0);
        return {
          schema_name: t.schema_name, table_name: t.table_name,
          columns: c.map((x: any) => ({ name: x.name, type: x.type, max_length: x.max_length, precision: x.precision, scale: x.scale, nullable: !!x.is_nullable, ordinal: x.column_id })),
          primary_key: pk,
          foreign_keys: (fkBy[t.object_id] || []).map((f: any) => ({ name: f.fk_name, column: f.column_name, ref_table: f.ref_table, ref_column: f.ref_column })),
          order_by: (stable ? pk : orderable).map(q).join(', ') || '(SELECT NULL)',
          stable_order: stable,
          source_row_count: Number(t.row_count || 0),
          status: 'pending', chunk_size: c.length > 60 ? 500 : 2000, chunks: [], next_offset: 0, migrated_row_count: 0,
        };
      });
      const newRun = await E.SislocArchiveRun.create({
        source_id: body.source_id || '', source_name: source.name || source.branch_name || '', version,
        status: 'inventoried', table_count: tableRecords.length, total_source_rows: total,
        limitations, inventoried_at: new Date().toISOString(), performed_by: user.email,
      });
      for (let i = 0; i < tableRecords.length; i += 200) {
        await E.SislocArchiveTable.bulkCreate(tableRecords.slice(i, i + 200).map((t: any) => ({ ...t, run_id: newRun.id })));
      }
      return Response.json({ run: newRun });
    }

    if (action === 'extract') {
      // Uma página por chamada; o checkpoint (next_offset) só avança após o lote salvo — retomada idempotente.
      const offset = Number(table.next_offset || 0);
      const size = Number(table.chunk_size || 2000);
      const colList = (table.columns || []).map((c: any) => q(c.name)).join(', ') || '*';
      const res = await runQuery(source, wrap(`SELECT ${colList} FROM ${q(table.schema_name)}.${q(table.table_name)} WITH (NOLOCK)
        ORDER BY ${table.order_by} OFFSET ${offset} ROWS FETCH NEXT ${size} ROWS ONLY`), 120000);
      const rows = rowsOf(res);
      const names = (table.columns || []).map((c: any) => c.name);
      const chunks = [...(table.chunks || [])];
      const index = Math.floor(offset / size);
      if (rows.length) {
        const payload = JSON.stringify({ table: table.table_name, offset, columns: names, rows: rows.map((r: any) => names.map((n: string) => serialize(r[n]))) });
        const file = new File([payload], `${run.version}_${table.table_name}_${index}.json`, { type: 'application/json' });
        const { file_uri } = await base44.asServiceRole.integrations.Core.UploadPrivateFile({ file });
        const existing = chunks.findIndex((c: any) => c.index === index);
        const entry = { index, offset, rows: rows.length, file_uri };
        if (existing >= 0) chunks[existing] = entry; else chunks.push(entry);
      }
      const migrated = chunks.reduce((s: number, c: any) => s + c.rows, 0);
      const done = rows.length < size;
      const updated = await E.SislocArchiveTable.update(table.id, {
        chunks, migrated_row_count: migrated, next_offset: offset + rows.length,
        status: done ? 'done' : 'extracting', last_error: '',
      });
      return Response.json({ table: updated, done });
    }

    if (action === 'validate') {
      const n = await countRows(source, wrap, table);
      const ok = n === Number(table.migrated_row_count || 0);
      const updated = await E.SislocArchiveTable.update(table.id, {
        validated_source_count: n, validated_at: new Date().toISOString(),
        status: ok ? 'validated' : 'divergent',
      });
      return Response.json({ table: updated, ok });
    }

    return Response.json({ error: 'Ação inválida.' }, { status: 400 });
  } catch (error) {
    if (source) await closePool(source).catch(() => {});
    return Response.json({ error: (error as Error).message || String(error) }, { status: 500 });
  }
}