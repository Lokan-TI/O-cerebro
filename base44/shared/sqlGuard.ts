// Guard for the administrative ad-hoc SQL runner.
// P0-02: "starts with SELECT" is not a security control. This module normalizes the
// statement, rejects anything that is not a single read-only statement, and blocks
// stacked statements, comments, DDL/DML, and known SQL Server abuse surfaces.

export const MAX_QUERY_LENGTH = 20000;
export const MAX_ROWS_RETURNED = 5000;

// Blocked tokens (matched as whole words, case-insensitive).
const BLOCKED_TOKENS = [
  'INSERT', 'UPDATE', 'DELETE', 'MERGE', 'TRUNCATE', 'DROP', 'CREATE', 'ALTER',
  'GRANT', 'REVOKE', 'DENY', 'BACKUP', 'RESTORE', 'SHUTDOWN', 'RECONFIGURE',
  'EXEC', 'EXECUTE', 'XP_CMDSHELL', 'SP_CONFIGURE', 'SP_EXECUTESQL',
  'OPENROWSET', 'OPENDATASOURCE', 'OPENQUERY', 'OPENXML', 'BULK',
  'WAITFOR', 'INTO', 'DBCC', 'KILL', 'DECLARE', 'SET', 'USE', 'GO',
];

export class SqlGuardError extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
  }
}

// Removes line and block comments so they cannot be used to smuggle tokens
// past the validator (and so a comment cannot hide a second statement).
function stripComments(input: string): string {
  let out = '';
  let i = 0;
  while (i < input.length) {
    const two = input.slice(i, i + 2);
    if (two === '--') {
      const nl = input.indexOf('\n', i);
      if (nl === -1) break;
      out += '\n';
      i = nl + 1;
      continue;
    }
    if (two === '/*') {
      const end = input.indexOf('*/', i + 2);
      if (end === -1) throw new SqlGuardError('Comentário de bloco não fechado na query.', 400);
      out += ' ';
      i = end + 2;
      continue;
    }
    // Preserve string literals verbatim
    if (input[i] === "'") {
      const end = input.indexOf("'", i + 1);
      if (end === -1) throw new SqlGuardError('String literal não fechada na query.', 400);
      out += input.slice(i, end + 1);
      i = end + 1;
      continue;
    }
    out += input[i];
    i += 1;
  }
  return out;
}

// Replaces string literals with a placeholder so token scanning ignores data content.
function maskLiterals(input: string): string {
  return input.replace(/'(?:[^']|'')*'/g, "''");
}

function countStatements(masked: string): number {
  const trimmed = masked.trim().replace(/;+\s*$/, '');
  return trimmed.includes(';') ? 2 : 1;
}

/**
 * Validates and normalizes an ad-hoc query.
 * Returns the cleaned SQL that is safe to send to the read-only connection.
 * Throws SqlGuardError with an HTTP status on rejection.
 */
export function assertReadOnlyQuery(raw: unknown): string {
  if (!raw || typeof raw !== 'string' || !raw.trim()) {
    throw new SqlGuardError('Parâmetro "query" é obrigatório.', 400);
  }
  if (raw.length > MAX_QUERY_LENGTH) {
    throw new SqlGuardError(`Query excede o limite de ${MAX_QUERY_LENGTH} caracteres.`, 400);
  }

  const cleaned = stripComments(raw).trim().replace(/;+\s*$/, '').trim();
  if (!cleaned) throw new SqlGuardError('Query vazia após remoção de comentários.', 400);

  const masked = maskLiterals(cleaned);

  if (countStatements(masked) > 1) {
    throw new SqlGuardError('Apenas uma instrução por execução. Comandos empilhados com ";" são bloqueados.', 403);
  }

  const upper = masked.toUpperCase();
  if (!/^(SELECT|WITH)\b/.test(upper)) {
    throw new SqlGuardError('Apenas consultas SELECT ou WITH são permitidas (somente leitura).', 403);
  }

  for (const token of BLOCKED_TOKENS) {
    const re = new RegExp(`(^|[^A-Z0-9_@#$])${token}([^A-Z0-9_@#$]|$)`, 'i');
    if (re.test(upper)) {
      throw new SqlGuardError(`Comando não permitido na área analítica: "${token}".`, 403);
    }
  }

  return cleaned;
}