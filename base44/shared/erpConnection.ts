import sql from 'npm:mssql@10.0.1';

// Pool cache keyed by source id (or 'env' for the Matriz / env-based connection)
const pools = new Map();

// Global mutex — the DW_API wrapper serializes server-side, so we run one query at a time
// across all sources to prevent concurrent-pool crashes in the Deno worker.
let queryInFlight = Promise.resolve();
function serialize(task) {
  const next = queryInFlight.then(task, task);
  queryInFlight = next.then(() => {}, () => {});
  return next;
}

// Build a mssql connection config + DW_API client id from a source record.
// credential_reference "env" → uses platform environment variables (Matriz).
// Otherwise → uses the entity-stored connection fields.
export function buildConfig(source) {
  if (!source) return null;
  if (source.credential_reference === 'env') {
    const clientId = Deno.env.get('DW_API_CLIENT_ID');
    const host = Deno.env.get('SQL_SERVER_HOST');
    if (!clientId || !host) return null;
    return {
      config: {
        server: host,
        port: parseInt(Deno.env.get('SQL_SERVER_PORT') || '1433'),
        database: Deno.env.get('SQL_SERVER_DATABASE'),
        user: Deno.env.get('SQL_SERVER_USER'),
        password: Deno.env.get('SQL_SERVER_PASSWORD'),
        options: { encrypt: false, trustServerCertificate: true },
        requestTimeout: 25000,
      },
      clientId,
    };
  }
  if (!source.host || !source.database_name) return null;
  return {
    config: {
      server: source.host,
      port: parseInt(source.port) || 1433,
      database: source.database_name,
      user: source.username,
      password: source.password,
      options: { encrypt: !!source.use_ssl, trustServerCertificate: true },
      requestTimeout: (source.connection_timeout || 25) * 1000,
    },
    clientId: source.dw_api_client_id || null,
  };
}

function poolKeyFor(source) {
  if (source?.credential_reference === 'env') return 'env';
  return source?.id || `${source?.host}:${source?.database_name}` || 'entity';
}

async function getPool(key, config) {
  const existing = pools.get(key);
  if (existing) {
    try {
      const pool = await existing;
      if (pool && pool.connected) return pool;
    } catch {}
    pools.delete(key);
  }
  const promise = sql.connect({
    ...config,
    connectionTimeout: 10000,
    pool: { max: 1, min: 0, idleTimeoutMillis: 30000 },
  });
  pools.set(key, promise);
  return await promise;
}

// Run a query against a source's pool, serialized globally.
export async function runQuery(source, execSql) {
  const key = poolKeyFor(source);
  const built = buildConfig(source);
  if (!built) throw new Error('Configuração de conexão incompleta para a fonte selecionada.');
  return await serialize(async () => {
    const pool = await getPool(key, built.config);
    return await pool.request().query(execSql);
  });
}

export async function closePool(source) {
  const key = poolKeyFor(source);
  const entry = pools.get(key);
  if (entry) {
    try { const pool = await entry; if (pool) await pool.close(); } catch {}
    pools.delete(key);
  }
}