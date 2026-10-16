import { readRows, digitSql, quote, digits, text } from './customerScope.ts';

// RdLead does not retain its ERP source. A numeric ERP id alone is NOT sufficient.
// Require an existing accepted link AND a uniquely verified identifier in this source.
export async function customerRdScope(source, person, scope) {
  const keys = [];
  for (const doc of [...new Set([digits(person.nr_cpf_pessoa), digits(person.nr_cnpj_pessoa)].filter((d) => [11, 14].includes(d.length)))]) {
    keys.push({ field: 'identity_doc', value: doc, sql: `(${digitSql('nr_cpf_pessoa')}=${quote(doc)} OR ${digitSql('nr_cnpj_pessoa')}=${quote(doc)})` });
  }
  for (const email of [...new Set(text(person.en_mail_pessoa).toLowerCase().split(/[;,\s]+/).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)))]) {
    keys.push({ field: 'identity_email', value: email,
      sql: `CHARINDEX(${quote(';' + email + ';')},';'+REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(LOWER(ISNULL(CAST(en_mail_pessoa AS varchar(2000)),'')),',',';'),' ',';'),CHAR(13),';'),CHAR(10),';'),CHAR(9),';')+';')>0` });
  }
  for (const phone of [...new Set([person.tel_pessoa, person.tl_cel_pessoa, person.tl_res_pessoa].map(digits).filter((d) => d.length >= 10).map((d) => d.slice(-9)))]) {
    keys.push({ field: 'identity_phone', value: phone,
      sql: `(${['tel_pessoa', 'tl_cel_pessoa', 'tl_res_pessoa'].map((c) => `RIGHT(${digitSql(c)},9)=${quote(phone)}`).join(' OR ')})` });
  }
  if (!keys.length) return null;
  const counts = (await readRows(source, `SELECT ${keys.map((k, i) => `COUNT(DISTINCT CASE WHEN ${k.sql} THEN cd_pessoa END) AS k${i}`).join(',')}
    FROM pessoa WITH (NOLOCK) WHERE ${keys.map((k) => '(' + k.sql + ')').join(' OR ')}`))[0] || {};
  const unique = keys.filter((_, i) => Number(counts['k' + i]) === 1).map((k) => ({ [k.field]: k.value }));
  if (!unique.length) return null;
  return { erp_cd_pessoa: String(person.cd_pessoa).trim(), match_status: { $in: ['matched', 'manual'] },
    ...(scope.cd_empresa == null ? {} : { erp_cd_empresa: String(scope.cd_empresa) }), $or: unique };
}

export async function customerRdSummary(base44, user, source, person, scope) {
  if (user.role !== 'admin') return { available: false, note: 'RD CRM e Conversas: acesso restrito a administradores, conforme as permissões existentes.' };
  const identity = await customerRdScope(source, person, scope);
  const sync = {};
  for (const product of ['crm', 'conversas']) {
    const page = await base44.entities.RdSyncRun.filter({ product }, { sort: '-started_at', limit: 1,
      fields: ['product', 'status', 'started_at', 'finished_at', 'last_error'] });
    sync[product] = page.items[0] || null;
  }
  if (!identity) return { available: true, identity_verified: false, rows: [], sync,
    note: 'Não foi encontrado documento, e-mail ou telefone único nesta base para validar os vínculos RD. Registros não foram misturados.' };
  const result = await base44.entities.RdLead.aggregate({ query: { ...identity, product: { $in: ['crm_deal', 'conversas'] } },
    groupBy: 'product', min: ['source_created_at'], max: ['source_created_at', 'synced_at'] });
  return { available: true, identity_verified: true, rows: result.rows, sync,
    note: 'Somente registros sincronizados com vínculo aceito e identidade única nesta base. Registros pendentes, ambíguos ou sem vínculo não são atribuídos. Atendimento não inclui o conteúdo das mensagens.' };
}

export async function customerRdTimeline(base44, user, source, person, scope, body) {
  if (user.role !== 'admin') return { success: true, events: [], next_cursor: null, note: 'Acesso RD restrito a administradores.' };
  const identity = await customerRdScope(source, person, scope);
  if (!identity) return { success: true, events: [], next_cursor: null, note: 'Sem identidade única validada; isso não comprova ausência de atividade no RD.' };
  const product = body.category === 'crm' ? 'crm_deal' : 'conversas';
  const page = await base44.entities.RdLead.filter({ ...identity, product }, { sort: '-source_created_at', limit: 30, cursor: body.cursor || undefined,
    fields: ['external_id', 'name', 'source_created_at', 'closed_at', 'deal_status', 'amount', 'stage', 'pipeline', 'owner', 'origin', 'campaign', 'synced_at'] });
  const labels = { open: 'Em aberto', paused: 'Pausada', won: 'Ganha', lost: 'Perdida' };
  return { success: true, events: page.items.map((r) => ({ event_id: r.id, event_at: r.source_created_at, kind: product,
    reference: r.external_id, title: r.name, status: labels[r.deal_status] || r.stage || 'Sem etapa registrada',
    amount: product === 'crm_deal' ? r.amount : null, amount_label: 'Valor da negociação (não é faturamento)',
    owner: r.owner, pipeline: r.pipeline, stage: r.stage, origin: r.origin, campaign: r.campaign, closed_at: r.closed_at, synced_at: r.synced_at })),
    next_cursor: page.has_more ? page.next_cursor : null,
    note: product === 'conversas' ? 'Atendimentos e tabulações sincronizados; o conteúdo das mensagens não está disponível. Ausência de vínculo não significa ausência de conversas.' : 'Histórico comercial sincronizado. Valores de negociações não são somados ao faturamento fiscal.' };
}