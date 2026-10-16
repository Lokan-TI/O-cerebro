import sql from 'npm:mssql@10.0.1';
import { buildConfig } from './erpConnection.ts';

// Dedicated pools avoid sql.connect's process-global pool crossing source boundaries.
export default async function customerErpRead(source, query) {
  const built = buildConfig(source);
  if (!built) throw new Error('Configuração de conexão incompleta para a fonte selecionada.');
  const pool = new sql.ConnectionPool({ ...built.config, connectionTimeout: 8000,
    requestTimeout: 15000, pool: { max: 1, min: 0, idleTimeoutMillis: 1000 } });
  const started = Date.now();
  let request, timer, closeTimer;
  const statement = built.clientId
    ? `EXEC DW_API '${String(built.clientId).replace(/'/g, "''")}', '${query.replace(/'/g, "''")}'`
    : query;
  const operation = (async () => {
    await pool.connect();
    request = pool.request();
    return await request.query(statement);
  })();
  try {
    return await Promise.race([operation, new Promise((_, reject) => {
      timer = setTimeout(() => {
        request?.cancel();
        reject(new Error('Consulta ao ERP: o banco não respondeu em 25s.'));
      }, 25000);
    })]);
  } finally {
    clearTimeout(timer);
    await Promise.race([pool.close().catch(() => {}), new Promise((resolve) => {
      closeTimer = setTimeout(resolve, 2000);
    })]);
    clearTimeout(closeTimer);
    console.info('customer_erp_read', { duration_ms: Date.now() - started });
  }
}