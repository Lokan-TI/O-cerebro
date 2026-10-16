import { readRows, quote, digits, digitSql, personColumns, membershipSql, sourceFor, text } from './customerScope.ts';

export async function searchCustomers(base44, body, empresa) {
  const term = text(body.term).slice(0, 100);
  if (term.length < 3) return { success: true, rows: [], next_cursor: null, warnings: [] };
  const cursor = body.cursor || {};
  const after = Math.max(0, Number(cursor.after) || 0);
  const start = Math.max(0, Number(cursor.source_index) || 0);
  if (!Number.isSafeInteger(after) || !Number.isSafeInteger(start)) throw new Error('Página inválida.');
  let sources;
  if (body.source_id === '__all__') {
    const page = await base44.asServiceRole.entities.ErpDataSource.filter({}, { sort: 'id', limit: 50 });
    if (page.has_more) throw new Error('Selecione uma fonte para consultar esta quantidade de bases.');
    sources = page.items;
  } else sources = [await sourceFor(base44, body.source_id)];
  const d = digits(term);
  const numeric = /^[\d\s()+./-]+$/.test(term) && d.length >= 3;
  const like = (v) => quote('%' + v.replace(/[~%_\[]/g, (c) => '~' + c) + '%');
  const where = numeric
    ? ['nr_cpf_pessoa', 'nr_cnpj_pessoa', 'tel_pessoa', 'tl_cel_pessoa', 'tl_res_pessoa'].map((f) => `${digitSql('p.' + f)} LIKE ${quote('%' + d + '%')}`).join(' OR ')
    : `(p.nm_pessoa LIKE ${like(term)} ESCAPE '~' OR p.nm_fan_pessoa LIKE ${like(term)} ESCAPE '~')`;
  const rows = [], warnings = [];
  for (let i = start; i < sources.length; i++) {
    const source = sources[i], capacity = 20 - rows.length;
    try {
      const page = await readRows(source, `SELECT TOP ${capacity + 1} ${personColumns} FROM pessoa p WITH (NOLOCK)
        WHERE p.fl_cliente_pessoa=1 AND p.cd_pessoa>${i === start ? after : 0} AND (${where}) ${membershipSql(empresa)} ORDER BY p.cd_pessoa`);
      const selected = page.slice(0, capacity);
      rows.push(...selected.map((p) => ({ id: String(p.cd_pessoa), name: text(p.nm_pessoa), trade_name: text(p.nm_fan_pessoa),
        document: text(p.nr_cnpj_pessoa) || text(p.nr_cpf_pessoa), phone: text(p.tl_cel_pessoa) || text(p.tel_pessoa) || text(p.tl_res_pessoa),
        source_id: source.id || null, source_name: source.name || 'Matriz' })));
      if (page.length > capacity) return { success: true, rows, warnings, next_cursor: { source_index: i, after: Number(selected.at(-1).cd_pessoa) } };
      if (rows.length === 20) return { success: true, rows, warnings, next_cursor: i + 1 < sources.length ? { source_index: i + 1, after: 0 } : null };
    } catch (error) { warnings.push(`${source.name || 'Matriz'}: busca indisponível. ${error.message}`); }
  }
  return { success: true, rows, warnings, next_cursor: null };
}