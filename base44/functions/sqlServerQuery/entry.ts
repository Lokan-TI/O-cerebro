import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import sql from 'npm:mssql@10.0.1';

// Cached env config — read once, reused across requests to avoid cold-start env misses
let cachedConfig = null;
let cachedClientId = null;

function getConfig() {
  if (cachedConfig && cachedClientId) {
    return { config: cachedConfig, clientId: cachedClientId, host: cachedConfig.server };
  }
  const clientId = Deno.env.get('DW_API_CLIENT_ID');
  const host = Deno.env.get('SQL_SERVER_HOST');
  if (clientId && host) {
    cachedConfig = {
      server: host,
      port: parseInt(Deno.env.get('SQL_SERVER_PORT') || '1433'),
      database: Deno.env.get('SQL_SERVER_DATABASE'),
      user: Deno.env.get('SQL_SERVER_USER'),
      password: Deno.env.get('SQL_SERVER_PASSWORD'),
      options: { encrypt: false, trustServerCertificate: true },
      requestTimeout: 25000,
    };
    cachedClientId = clientId;
  }
  return {
    config: cachedConfig,
    clientId: clientId || cachedClientId,
    host: host,
  };
}

// Persistent connection pool — reused across requests
let poolPromise = null;

async function getPool(config) {
  if (poolPromise) {
    try {
      const pool = await poolPromise;
      if (pool && pool.connected) return pool;
      try { if (pool) await pool.close(); } catch {}
      poolPromise = null;
    } catch {
      poolPromise = null;
    }
  }
  poolPromise = sql.connect({
    ...config,
    connectionTimeout: 10000,
    pool: { max: 1, min: 0, idleTimeoutMillis: 30000 },
  });
  return await poolPromise;
}

// Mutex: DW_API serializes on the server side, so we must run one query at a time.
// Concurrent pool access leaks EventEmitter listeners and crashes the Deno worker.
let queryInFlight = Promise.resolve();
function serialize(task) {
  const next = queryInFlight.then(task, task); // run regardless of previous success/failure
  queryInFlight = next.then(() => {}, () => {});
  return next;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const query = body?.query;

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

    // Retry env var read to handle cold-start propagation delays
    let config, clientId, host;
    for (let i = 0; i < 5; i++) {
      ({ config, clientId, host } = getConfig());
      if (config && clientId && host) break;
      await new Promise(r => setTimeout(r, 300));
    }
    if (!host) {
      return Response.json({ error: 'SQL Server não configurado. Defina as variáveis SQL_SERVER_* nas configurações.' }, { status: 500 });
    }
    if (!clientId) {
      return Response.json({ error: 'DW_API_CLIENT_ID não configurado. Defina a variável nas configurações do app.' }, { status: 500 });
    }

    // Escape single quotes in the inner SQL for safe embedding inside the EXEC string
    const escapedSql = cleaned.replace(/'/g, "''");
    const execSql = `EXEC DW_API '${clientId}', '${escapedSql}'`;

    // Serialize so only one query touches the pool at a time
    const result = await serialize(async () => {
      const pool = await getPool(config);
      return await pool.request().query(execSql);
    });

    const rows = result.recordset || [];
    return Response.json({
      rows,
      rowCount: rows.length,
      multipleSets: result.recordsets || [],
    });
  } catch (error) {
    // Properly close the pool on error so the next request gets a fresh, clean connection
    if (poolPromise) {
      try { const p = await poolPromise; if (p) await p.close(); } catch {}
      poolPromise = null;
    }
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
});