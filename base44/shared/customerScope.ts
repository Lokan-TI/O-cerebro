import { execRead } from './erpConnection.ts';
import { scopedEmpresa } from './access.ts';

export const quote = (value) => `'${String(value).replace(/'/g, "''")}'`;
export const digits = (value) => String(value || '').replace(/\D/g, '');
export const text = (value) => String(value ?? '').trim();
export const numericId = (value) => {
  const s = String(value ?? '');
  if (!/^\d{1,12}$/.test(s)) throw new Error('Código de cliente inválido.');
  return s;
};
export const digitSql = (column) => ['.', '-', '/', '(', ')', ' ', '+'].reduce((sql, c) => `REPLACE(${sql},${quote(c)},'')`, `ISNULL(CAST(${column} AS varchar(255)),'')`);
export function rowsOf(result) {
  if (Array.isArray(result?.recordset)) return result.recordset;
  if (Array.isArray(result?.recordsets)) return result.recordsets.findLast((r) => Array.isArray(r) && r.length) || [];
  return [];
}
export const readRows = async (source, sql) => rowsOf(await execRead(source, sql, 25000));
export function empresaScope(user, requested) {
  const value = scopedEmpresa(user, requested);
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 0) throw new Error('Empresa fora do escopo de acesso.');
  return n;
}
export const companySql = (empresa, alias, column = 'cd_empresa') => empresa == null ? '' : ` AND ${alias}.${column} = ${empresa}`;
export function membershipSql(empresa) {
  if (empresa == null) return '';
  return ` AND (EXISTS (SELECT 1 FROM fich_loc f WITH (NOLOCK) WHERE f.cd_pessoa=p.cd_pessoa AND f.cd_empresa=${empresa})
    OR EXISTS (SELECT 1 FROM nf n WITH (NOLOCK) WHERE n.cd_pessoa=p.cd_pessoa AND n.cd_empresa=${empresa})
    OR EXISTS (SELECT 1 FROM mkt_orcamento m WITH (NOLOCK) WHERE m.cd_pessoa_cli=p.cd_pessoa AND m.cd_empresa=${empresa}))`;
}
export async function sourceFor(base44, id) {
  if (!id) return { credential_reference: 'env', name: 'Matriz' };
  if (id === '__all__') throw new Error('Selecione uma base para abrir o cliente.');
  const source = await base44.asServiceRole.entities.ErpDataSource.get(String(id));
  if (!source) throw new Error('Fonte não encontrada.');
  return source;
}
export const personColumns = `p.cd_pessoa, p.nm_pessoa, p.nm_fan_pessoa, p.nr_cpf_pessoa, p.nr_cnpj_pessoa,
 p.tel_pessoa, p.tl_cel_pessoa, p.tl_res_pessoa, p.en_mail_pessoa, p.cidade_pessoa, p.uf_pessoa, p.dt_cad_pessoa, p.fl_ativo`;
export async function personFor(source, id, empresa) {
  const rows = await readRows(source, `SELECT ${personColumns} FROM pessoa p WITH (NOLOCK)
    WHERE p.cd_pessoa=${numericId(id)} AND p.fl_cliente_pessoa=1 ${membershipSql(empresa)}`);
  if (!rows[0]) throw new Error('Cliente não encontrado no escopo permitido.');
  return rows[0];
}
export function historyScope(source, empresa) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const end = new Date(today + 'T00:00:00Z'); end.setUTCDate(end.getUTCDate() + 1);
  return { source_id: source.id || null, source_name: source.name || 'Matriz', cd_empresa: empresa,
    as_of: today, end_exclusive: end.toISOString().slice(0, 10), queried_at: new Date().toISOString() };
}