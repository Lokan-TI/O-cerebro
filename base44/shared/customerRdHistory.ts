import { readRows, digitSql, quote, digits, text } from './customerScope.ts';
import { crmGet } from './rdCrmOAuth.ts';

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
  // Vínculo por nº de proposta Sisloc (ficha única no ERP) dispensa identidade de contato.
  const proposal = { match_method: 'proposta_sisloc' };
  const base = { erp_cd_pessoa: String(person.cd_pessoa).trim(), match_status: { $in: ['matched', 'manual'] },
    ...(scope.cd_empresa == null ? {} : { erp_cd_empresa: String(scope.cd_empresa) }) };
  if (!keys.length) return { ...base, $or: [proposal] };
  const counts = (await readRows(source, `SELECT ${keys.map((k, i) => `COUNT(DISTINCT CASE WHEN ${k.sql} THEN cd_pessoa END) AS k${i}`).join(',')}
    FROM pessoa WITH (NOLOCK) WHERE ${keys.map((k) => '(' + k.sql + ')').join(' OR ')}`))[0] || {};
  const unique = keys.filter((_, i) => Number(counts['k' + i]) === 1).map((k) => ({ [k.field]: k.value }));
  return { ...base, $or: [...unique, proposal] };
}

// Tarefas comerciais (ligações, WhatsApp, e-mails, visitas) das negociações, lidas ao vivo no RD CRM.
const TASK_TYPES = { call: 'Ligação', whatsapp: 'WhatsApp', email: 'E-mail', meeting: 'Reunião', visit: 'Visita', task: 'Tarefa', lunch: 'Almoço' };
async function dealTasks(base44, deals) {
  if (!deals.length) return { events: [], error: null };
  try {
    const users = Object.fromEntries(((await crmGet(base44, 'users', { 'page[size]': '100' })).data || []).map((u) => [u.id, u.name || u.email]));
    const events = [];
    for (const d of deals) {
      const res = await crmGet(base44, 'tasks', { filter: `deal_id:${d.external_id}`, 'page[size]': '100' });
      for (const t of res.data || []) events.push({ event_id: 't:' + t.id, event_at: t.completed_at || t.due_date || t.created_at, kind: 'crm_task',
        reference: t.id, title: `${TASK_TYPES[t.type] || t.type || 'Tarefa'} · ${t.name || 'sem título'}`,
        status: t.status === 'completed' ? `Concluída em ${String(t.completed_at || '').slice(0, 10).split('-').reverse().join('/')}` : `Pendente · prevista para ${String(t.due_date || '').slice(0, 10).split('-').reverse().join('/')}`,
        owner: users[t.completed_by_id] || (t.owner_ids || []).map((id) => users[id]).filter(Boolean).join(', '), deal_name: d.name });
    }
    return { events, error: null };
  } catch (e) { return { events: [], error: String(e.message).slice(0, 160) }; }
}

// Detalhe ao vivo da negociação + anotações/eventos (activities). O que a API não fornece é declarado.
const DEAL_LABEL = { won: 'Vendida', lost: 'Perdida', ongoing: 'Em andamento', paused: 'Pausada', open: 'Em andamento' };
const brDate = (s) => String(s || '').slice(0, 10).split('-').reverse().join('/');
async function catalog(base44, path) {
  try { return Object.fromEntries(((await crmGet(base44, path, { 'page[size]': '100' })).data || []).map((x) => [x.id, x.name || x.label || x.slug])); }
  catch { return {}; }
}
async function dealJourney(base44, deals, users) {
  const out = { details: {}, events: [], errors: [] };
  if (!deals.length) return out;
  const reasons = await catalog(base44, 'lost_reasons');
  for (const d of deals) {
    try {
      const x = (await crmGet(base44, `deals/${d.external_id}`)).data || {};
      const fields = Object.entries(x.custom_fields || {}).filter(([, v]) => v != null && String(v).trim() !== '')
        .map(([k, v]) => ({ label: k.replace(/-/g, ' '), value: Array.isArray(v) ? v.join(', ') : String(v).trim() }));
      out.details[d.external_id] = { live_status: x.status, lost_reason: reasons[x.lost_reason_id] || x.lost_reason?.name || x.lost_reason_id || '', updated_at: x.updated_at, fields };
    } catch (e) { out.errors.push('detalhe da negociação: ' + String(e.message).slice(0, 100)); }
    try {
      for (const n of (await crmGet(base44, `deals/${d.external_id}/notes`, { 'page[size]': '100' })).data || []) {
        out.events.push({ event_id: 'n:' + n.id, event_at: n.created_at || n.date, kind: 'crm_note', reference: n.id, title: 'Anotação no RD',
          status: String(n.text || n.content || n.description || '').slice(0, 600), owner: users[n.user_id] || n.user?.name || '', deal_name: d.name });
      }
    } catch (e) { out.errors.push('anotações: ' + String(e.message).slice(0, 100)); }
  }
  return out;
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
    fields: ['external_id', 'name', 'source_created_at', 'closed_at', 'deal_status', 'amount', 'stage', 'pipeline', 'owner', 'origin', 'campaign', 'synced_at', 'match_method', 'custom_sisloc_proposal'] });
  const labels = DEAL_LABEL;
  const methods = { proposta_sisloc: 'nº da proposta Sisloc', doc: 'CPF/CNPJ', email: 'e-mail', tel: 'telefone', combinado: 'identidades combinadas', manual: 'decisão manual' };
  const deals = page.items.map((r) => ({ event_id: r.id, event_at: r.source_created_at, kind: product,
    reference: r.external_id, title: r.name, status: labels[r.deal_status] || r.stage || 'Sem etapa registrada',
    amount: product === 'crm_deal' ? r.amount : null, amount_label: 'Valor da negociação (não é faturamento)',
    owner: r.owner, pipeline: r.pipeline, stage: r.stage, origin: r.origin, campaign: r.campaign, closed_at: r.closed_at, synced_at: r.synced_at,
    link: methods[r.match_method] || r.match_method }));
  let tasks = { events: [], error: null };
  let journey = { details: {}, events: [], errors: [] };
  if (product === 'crm_deal') {
    tasks = await dealTasks(base44, page.items);
    journey = await dealJourney(base44, page.items, await catalog(base44, 'users'));
    for (const ev of deals) {
      const j = journey.details[ev.reference];
      const r = page.items.find((x) => x.external_id === ev.reference);
      if (j?.live_status) ev.status = labels[j.live_status] || ev.status;
      ev.sale_state = (j?.live_status || r.deal_status) === 'won' ? 'won' : (j?.live_status || r.deal_status) === 'lost' ? 'lost' : 'open';
      if (ev.sale_state === 'won') ev.status += ev.closed_at ? ` em ${brDate(ev.closed_at)} (venda comercial no RD; faturamento é conferido no ERP)` : ' (venda comercial no RD)';
      ev.lost_reason = j?.lost_reason || '';
      ev.fields = j?.fields || [];
      ev.proposal = r.custom_sisloc_proposal || '';
      ev.updated_at = j?.updated_at || '';
    }
  }
  const events = [...deals, ...tasks.events, ...journey.events].sort((a, b) => String(b.event_at || '').localeCompare(String(a.event_at || '')));
  const crmNote = 'Negociações em qualquer etapa ou status e as tarefas comerciais registradas nelas (lidas ao vivo no RD CRM). Valores de negociações não são somados ao faturamento fiscal.'
    + ' A API do RD CRM não fornece o histórico de mudanças de etapa nem log de auditoria: são exibidos etapa e status atuais, datas de criação, fechamento e última atualização, tarefas e anotações.'
    + (tasks.error ? ` Tarefas indisponíveis agora: ${tasks.error}` : '') + (journey.errors.length ? ` Parte do detalhe ao vivo falhou: ${journey.errors[0]}` : '');
  return { success: true, events,
    next_cursor: page.has_more ? page.next_cursor : null,
    note: product === 'conversas' ? 'Atendimentos e tabulações sincronizados; o conteúdo das mensagens não está disponível. Ausência de vínculo não significa ausência de conversas.' : crmNote };
}