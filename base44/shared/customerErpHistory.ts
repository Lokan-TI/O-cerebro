import { readRows, companySql, numericId, quote } from './customerScope.ts';
import { invoiceUniverse } from './invoiceUniverse.ts';

export async function customerErpSummary(source, person, scope) {
  const id = numericId(person.cd_pessoa), end = quote(scope.end_exclusive), emp = scope.cd_empresa;
  const queries = {
    invoices: `SELECT COUNT(*) AS nfs, COALESCE(SUM(n.vl_faturamento),0) AS receita, MIN(n.dt_emi_nf) AS first_at, MAX(n.dt_emi_nf) AS last_at
      FROM nf n WITH (NOLOCK) WHERE n.cd_pessoa=${id} AND ${invoiceUniverse('n')} AND (n.dt_emi_nf<${end} OR n.dt_emi_nf IS NULL) ${companySql(emp, 'n')}`,
    rentals: `SELECT COUNT(CASE WHEN f.tp_ope_pedido='L' THEN 1 END) AS rentals,
      COUNT(CASE WHEN f.tp_ope_pedido='O' THEN 1 END) AS quotes,
      COUNT(CASE WHEN f.tp_ope_pedido='L' AND f.dt_enc_ficha IS NULL AND ISNULL(CAST(f.fl_baixada AS varchar(5)),'N') NOT IN ('S','1') THEN 1 END) AS active,
      MIN(CASE WHEN f.tp_ope_pedido='L' THEN f.dt_pedido END) AS first_at,
      MAX(CASE WHEN f.tp_ope_pedido='L' THEN f.dt_pedido END) AS last_at,
      MAX(CASE WHEN f.tp_ope_pedido='O' THEN f.dt_pedido END) AS last_quote_at,
      MIN(f.dt_pedido) AS first_event_at, MAX(f.dt_pedido) AS last_event_at
      FROM fich_loc f WITH (NOLOCK) WHERE f.cd_pessoa=${id} AND f.tp_ope_pedido IN ('O','L')
      AND (f.dt_pedido<${end} OR f.dt_pedido IS NULL) ${companySql(emp, 'f')}`,
    proposals: `SELECT COUNT(*) AS proposals, MIN(m.dt_orcamento) AS first_at, MAX(m.dt_orcamento) AS last_at,
      MAX(CASE WHEN m.dt_cancelamento IS NULL THEN m.dt_orcamento END) AS last_not_cancelled_at,
      COUNT(CASE WHEN m.dt_aprovacao IS NOT NULL THEN 1 END) AS approved,
      COUNT(CASE WHEN m.dt_cancelamento IS NOT NULL THEN 1 END) AS cancelled
      FROM mkt_orcamento m WITH (NOLOCK) WHERE m.cd_pessoa_cli=${id} AND (m.dt_orcamento<${end} OR m.dt_orcamento IS NULL) ${companySql(emp, 'm')}`,
  };
  const summary = {}, coverage = {};
  for (const [key, sql] of Object.entries(queries)) {
    try { summary[key] = (await readRows(source, sql))[0] || {}; coverage[key] = { available: true }; }
    catch (error) { summary[key] = null; coverage[key] = { available: false, error: String(error.message).slice(0, 240) }; }
  }
  return { summary, coverage };
}

export async function customerErpTimeline(source, person, scope, body) {
  const id = numericId(person.cd_pessoa), emp = scope.cd_empresa, end = quote(scope.end_exclusive);
  const parts = [
    `SELECT CONCAT('f:',f.cd_controle) AS event_id, f.dt_pedido AS event_at,
      CASE WHEN f.tp_ope_pedido='L' THEN 'locacao' ELSE 'orcamento_ficha' END AS kind,
      CAST(f.numero AS varchar(60)) AS reference, f.cd_empresa AS empresa,
      CASE WHEN f.dt_enc_ficha IS NOT NULL THEN 'Encerrada' WHEN ISNULL(CAST(f.fl_baixada AS varchar(5)),'N') IN ('S','1') THEN 'Baixada' ELSE 'Sem baixa/encerramento' END AS status,
      f.vl_minimo_locacao AS amount, 'Valor mínimo da ficha' AS amount_label,
      CAST(f.contato AS nvarchar(200)) AS contact, CAST(f.telefone AS varchar(100)) AS phone,
      CAST(f.observacao AS nvarchar(2000)) AS notes, f.dt_enc_ficha AS closed_at, f.dt_prevista_devolucao AS expected_return
      FROM fich_loc f WITH (NOLOCK) WHERE f.cd_pessoa=${id} AND f.tp_ope_pedido IN ('L','O') AND (f.dt_pedido<${end} OR f.dt_pedido IS NULL) ${companySql(emp, 'f')}`,
    `SELECT CONCAT('n:',n.cd_nf), n.dt_emi_nf, 'faturamento', CAST(n.cd_nf AS varchar(60)), n.cd_empresa,
      'NF de saída válida', n.vl_faturamento, 'Faturamento fiscal', NULL, NULL, NULL, NULL, NULL
      FROM nf n WITH (NOLOCK) WHERE n.cd_pessoa=${id} AND ${invoiceUniverse('n')} AND (n.dt_emi_nf<${end} OR n.dt_emi_nf IS NULL) ${companySql(emp, 'n')}`,
  ];
  if (body.include_proposals !== false) parts.push(`SELECT CONCAT('m:',m.cd_controle), m.dt_orcamento, 'proposta', CAST(m.numero AS varchar(60)), m.cd_empresa,
    CASE WHEN m.dt_cancelamento IS NOT NULL THEN 'Cancelada' WHEN m.dt_aprovacao IS NOT NULL THEN 'Aprovada' ELSE 'Sem aprovação registrada' END,
    NULL, NULL, NULL, NULL, NULL, m.dt_aprovacao, NULL
    FROM mkt_orcamento m WITH (NOLOCK) WHERE m.cd_pessoa_cli=${id} AND (m.dt_orcamento<${end} OR m.dt_orcamento IS NULL) ${companySql(emp, 'm')}`);
  let cursorSql = '';
  if (body.cursor) {
    const key = String(body.cursor.event_id || '');
    if (!/^[fnm]:\d+$/.test(key)) throw new Error('Página de histórico inválida.');
    if (body.cursor.date == null) cursorSql = `WHERE h.event_at IS NULL AND h.event_id<${quote(key)}`;
    else {
      const d = new Date(body.cursor.date);
      if (!Number.isFinite(d.getTime())) throw new Error('Data de paginação inválida.');
      const dt = `CONVERT(datetime2,${quote(d.toISOString().replace('Z', ''))},126)`;
      cursorSql = `WHERE h.event_at<${dt} OR (h.event_at=${dt} AND h.event_id<${quote(key)}) OR h.event_at IS NULL`;
    }
  }
  const found = await readRows(source, `SELECT TOP 31 h.* FROM (${parts.join(' UNION ALL ')}) h ${cursorSql} ORDER BY h.event_at DESC,h.event_id DESC`);
  const events = found.slice(0, 30), last = events.at(-1);
  return { success: true, events, next_cursor: found.length > 30 ? { date: last.event_at, event_id: last.event_id } : null };
}