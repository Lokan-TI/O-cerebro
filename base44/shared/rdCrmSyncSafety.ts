// Pure page validation and a single persistence path shared by sync and isolated checks.
export const crmPaginationVersion = 2;

export function crmPageParams(path, page, size = 100) {
  return { 'page[number]': String(page), 'page[size]': String(size), ...(['deals', 'contacts', 'organizations'].includes(path) ? { 'sort[created_at]': 'asc' } : {}) };
}

export function parseCrmPage(payload, size = 100) {
  if (!Array.isArray(payload?.data)) throw new Error('RD CRM: resposta sem lista data; paginação não concluída.');
  const data = payload.data;
  const ids = data.map((row) => String(row?.id || '').trim());
  if (ids.some((id) => !id) || new Set(ids).size !== ids.length) throw new Error('RD CRM: IDs vazios ou repetidos na página; sincronização interrompida.');
  const explicitNext = payload.links && Object.prototype.hasOwnProperty.call(payload.links, 'next');
  const more = explicitNext ? Boolean(payload.links.next) : data.length === size;
  if (more && !data.length) throw new Error('RD CRM: página vazia com continuação; sincronização interrompida.');
  return { data, more };
}

const identityFields = ['identity_email', 'identity_phone', 'identity_doc'];
const matchTextFields = ['match_method', 'erp_cd_pessoa', 'erp_nm_pessoa', 'erp_cd_empresa', 'erp_primeira_nf', 'erp_candidates', 'matched_at'];

export async function persistCrmRecords(db, incoming, runId, syncedAt) {
  if (!incoming.length) return;
  const keys = incoming.map((row) => row.external_key);
  if (incoming.length > 100 || keys.some((key) => !key) || new Set(keys).size !== keys.length) throw new Error('Lote CRM inválido ou duplicado.');
  const page = await db.RdLead.filter({ external_key: { $in: keys } }, {
    limit: 200, fields: ['external_key', 'match_status', 'match_method', ...identityFields],
  });
  const existing = new Map();
  for (const row of page.items) {
    if (existing.has(row.external_key)) throw new Error('Chave CRM duplicada na base; reconciliação necessária antes de sincronizar.');
    existing.set(row.external_key, row);
  }
  if (page.has_more) throw new Error('Leitura dos vínculos incompleta; nenhuma gravação realizada neste lote.');
  const records = incoming.map((row) => {
    const previous = existing.get(row.external_key);
    const next = { ...row, synced_at: syncedAt, run_id: runId };
    if (!previous) return { ...next, match_status: 'pending' };
    const changed = identityFields.some((field) => String(previous[field] || '') !== String(row[field] || ''));
    const manual = ['manual', 'rejected'].includes(previous.match_status) || previous.match_method === 'manual';
    if (changed && manual) throw new Error('Identidade de registro com decisão manual foi alterada no RD; revise o vínculo antes de retomar.');
    if (changed) {
      next.match_status = 'pending';
      for (const field of matchTextFields) next[field] = '';
      next.erp_receita_total = 0;
      next.erp_receita_pos_lead = 0;
    } else if (row.custom_sisloc_proposal && ['unmatched', 'no_identity', 'ambiguous'].includes(previous.match_status) && previous.match_method !== 'manual') {
      // Nova evidência (nº de proposta Sisloc): reavalia o vínculo automático sem tocar decisões manuais.
      next.match_status = 'pending';
    } else {
      // Upsert merges only supplied fields: omit the reset, retaining enrichment and decisions.
      delete next.match_status;
    }
    return next;
  });
  await db.RdLead.upsert(records, { key: 'external_key' });
}

export async function verifyCrmRun(db, runId, rowsRead) {
  const distinctStored = await db.RdLead.count({ run_id: runId, product: { $in: ['crm_contact', 'crm_deal'] } });
  return { pagination_version: crmPaginationVersion, rows_read: rowsRead, distinct_stored: distinctStored, complete: rowsRead === distinctStored };
}