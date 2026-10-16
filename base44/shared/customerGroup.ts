import { readRows, quote, digits, text, personColumns, membershipSql, companySql, numericId } from './customerScope.ts';
import { invoiceUniverse } from './invoiceUniverse.ts';

const toRow = (p, source) => ({ id: String(p.cd_pessoa), name: text(p.nm_pessoa), trade_name: text(p.nm_fan_pessoa),
  document: text(p.nr_cnpj_pessoa) || text(p.nr_cpf_pessoa), phone: text(p.tl_cel_pessoa) || text(p.tel_pessoa) || text(p.tl_res_pessoa),
  city: text(p.cidade_pessoa), uf: text(p.uf_pessoa), active: p.fl_ativo, registered_at: p.dt_cad_pessoa,
  source_id: source.id || null, source_name: source.name || 'Matriz' });
export { toRow as customerRow };

// Grupo = cadastros de cliente com nome (razão social) exatamente igual e CNPJ preenchido.
export async function groupMembers(source, name, empresa) {
  const exact = text(name).slice(0, 200);
  if (!exact) throw new Error('Nome do grupo inválido.');
  const rows = await readRows(source, `SELECT TOP 201 ${personColumns} FROM pessoa p WITH (NOLOCK)
    WHERE p.fl_cliente_pessoa=1 AND p.nm_pessoa=${quote(exact)} ${membershipSql(empresa)} ORDER BY p.cd_pessoa`);
  return { members: rows.slice(0, 200).map((p) => toRow(p, source)).filter((r) => r.name === exact && digits(r.document).length === 14),
    truncated: rows.length > 200 };
}

export async function groupCompare(base44, user, source, name, empresa, end) {
  const { members, truncated } = await groupMembers(source, name, empresa);
  if (!members.length) return { members: [], truncated };
  const ids = members.map((m) => numericId(m.id)).join(','), e = quote(end), stats = {};
  const merge = (rows) => rows.forEach((r) => { stats[String(r.cd_pessoa)] = { ...(stats[String(r.cd_pessoa)] || {}), ...r }; });
  merge(await readRows(source, `SELECT n.cd_pessoa, COUNT(*) AS nfs, COALESCE(SUM(n.vl_faturamento),0) AS receita, MAX(n.dt_emi_nf) AS last_nf
    FROM nf n WITH (NOLOCK) WHERE n.cd_pessoa IN (${ids}) AND ${invoiceUniverse('n')} AND n.dt_emi_nf<${e} ${companySql(empresa, 'n')} GROUP BY n.cd_pessoa`));
  merge(await readRows(source, `SELECT f.cd_pessoa, COUNT(CASE WHEN f.tp_ope_pedido='L' THEN 1 END) AS rentals,
    COUNT(CASE WHEN f.tp_ope_pedido='L' AND f.dt_enc_ficha IS NULL AND ISNULL(CAST(f.fl_baixada AS varchar(5)),'N') NOT IN ('S','1') THEN 1 END) AS active_rentals,
    MAX(CASE WHEN f.tp_ope_pedido='L' THEN f.dt_pedido END) AS last_rental, MAX(CASE WHEN f.tp_ope_pedido='L' THEN f.dt_enc_ficha END) AS last_return,
    MAX(CASE WHEN f.tp_ope_pedido='O' THEN f.dt_pedido END) AS last_quote
    FROM fich_loc f WITH (NOLOCK) WHERE f.cd_pessoa IN (${ids}) AND f.tp_ope_pedido IN ('O','L') AND f.dt_pedido<${e} ${companySql(empresa, 'f')} GROUP BY f.cd_pessoa`));
  merge(await readRows(source, `SELECT m.cd_pessoa_cli AS cd_pessoa, COUNT(*) AS proposals, MAX(m.dt_orcamento) AS last_proposal,
    COUNT(CASE WHEN m.dt_aprovacao IS NOT NULL THEN 1 END) AS approved, COUNT(CASE WHEN m.dt_cancelamento IS NOT NULL THEN 1 END) AS cancelled
    FROM mkt_orcamento m WITH (NOLOCK) WHERE m.cd_pessoa_cli IN (${ids}) AND m.dt_orcamento<${e} ${companySql(empresa, 'm')} GROUP BY m.cd_pessoa_cli`));
  const rd = {};
  if (user.role === 'admin') {
    const page = await base44.entities.RdLead.filter({ product: 'crm_deal', erp_cd_pessoa: { $in: members.map((m) => m.id) }, match_status: { $in: ['matched', 'manual'] } },
      { sort: '-source_created_at', limit: 500, fields: ['erp_cd_pessoa', 'deal_status', 'stage', 'owner', 'source_created_at', 'closed_at'] });
    for (const d of page.items) {
      const r = rd[d.erp_cd_pessoa] ||= { deals: 0, won: 0, lost: 0, open: 0, last: d };
      r.deals++; r[d.deal_status === 'won' ? 'won' : d.deal_status === 'lost' ? 'lost' : 'open']++;
    }
  }
  return { truncated, members: members.map((m) => ({ ...m, stats: stats[m.id] || {}, rd: rd[m.id] || null })) };
}