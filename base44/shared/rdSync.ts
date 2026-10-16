// Sincronização armazenada do RD Station (Marketing, CRM, Conversas) → entidade RdLead.
// Cada passo processa algumas páginas e devolve o cursor para retomar.
import { marketingAccessToken } from './rdStation.ts';
import { ensureAccessToken } from './rdOAuth.ts';
import { rdToken, assertActive } from './rdConfig.ts';
import { crmGet } from './rdCrmOAuth.ts';
import { normalizeCustomFields } from './rdCustomFields.ts';
import { crmPageParams, parseCrmPage, crmPaginationVersion } from './rdCrmSyncSafety.ts';

export const digits = (v: unknown) => String(v ?? '').replace(/\D/g, '');
export const normEmail = (v: unknown) => {
  const e = String(v ?? '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : '';
};
export const normPhone = (v: unknown) => { const d = digits(v); return d.length >= 10 ? d.slice(-9) : ''; };
export const normDoc = (v: unknown) => { const d = digits(v); return d.length === 11 || d.length === 14 ? d : ''; };

function identity(rec: any) {
  return {
    ...rec,
    identity_email: normEmail(rec.email),
    identity_phone: normPhone(rec.phone),
    identity_doc: normDoc(rec.document),
    match_status: 'pending',
  };
}

// Mensagens acionáveis conforme os códigos documentados (Marketing, CRM v1, Conversas v2).
export function rdErrorHint(status: number) {
  if (status === 401) return 'Credencial inválida ou expirada — gere/autorize novamente';
  if (status === 403) return 'Credencial válida, mas sem permissão para este recurso (plano ou visibilidade do usuário)';
  if (status === 404) return 'Recurso não encontrado na API RD';
  if (status === 429) return 'Limite de requisições da RD atingido — tente em alguns minutos';
  return 'Falha na API RD';
}

async function getJson(url: string, headers: Record<string, string>) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(25000) });
    // Limite documentado: 120 req/min (CRM v1 e Marketing Light/Basic/Pro). Espera progressiva antes de repetir.
    if (res.status === 429) { await new Promise((r) => setTimeout(r, 4000 * (attempt + 1))); continue; }
    const txt = await res.text();
    if (!res.ok) throw new Error(`${rdErrorHint(res.status)} (HTTP ${res.status}): ${txt.slice(0, 200)}`);
    return JSON.parse(txt);
  }
  throw new Error('Limite de requisições (429) persistente.');
}

// CRM v2: lookups (funis/etapas, usuários, fontes, campanhas) → empresas → contatos → negociações.
const CRM_SIZE = 100;
async function crmList(base44: any, path: string, page: number) {
  const j = await crmGet(base44, path, crmPageParams(path, page, CRM_SIZE));
  return parseCrmPage(j, CRM_SIZE);
}
async function crmAll(base44: any, path: string) {
  const out: any[] = [];
  for (let p = 1; p <= 50; p++) {
    const r = await crmList(base44, path, p);
    out.push(...r.data);
    if (!r.more) return out;
  }
  throw new Error('RD CRM: catálogo excedeu 50 páginas; leitura incompleta, sincronização interrompida.');
}
const toMap = (list: any[]) => Object.fromEntries(list.map((x) => [x.id, x.name || x.email || '']));
const DEAL_STATUS: Record<string, string> = { won: 'won', lost: 'lost', ongoing: 'open', paused: 'paused' };

async function crmPage(cursor: any, base44: any) {
  const phase = cursor.phase || 'lookups';
  if (phase === 'lookups') {
    const pipes = await crmAll(base44, 'pipelines');
    const stages: any[] = [];
    for (const p of pipes) stages.push(...(await crmAll(base44, `pipelines/${p.id}/stages`)));
    const maps = {
      pipe: toMap(pipes), stage: toMap(stages), user: toMap(await crmAll(base44, 'users')),
      source: toMap(await crmAll(base44, 'sources')), camp: toMap(await crmAll(base44, 'campaigns')),
    };
    return { records: [], cursor: { ...cursor, phase: 'organizations', page: 1, maps, orgs: {} } };
  }
  const page = cursor.page || 1;
  const { data, more } = await crmList(base44, phase, page);
  const next = (nextPhase: string | null) => more ? { ...cursor, page: page + 1 } : nextPhase ? { ...cursor, phase: nextPhase, page: 1 } : null;
  if (phase === 'organizations') {
    const orgs = { ...cursor.orgs };
    for (const o of data) orgs[o.id] = o.name || '';
    return { records: [], cursor: next('contacts') && { ...next('contacts'), orgs } };
  }
  if (phase === 'contacts') {
    const records = data.map((x: any) => identity({
      external_key: `crm_contact:${x.id}`, product: 'crm_contact', external_id: String(x.id), name: x.name || '',
      email: x.emails?.[0]?.email || '', phone: x.phones?.[0]?.phone || '',
      company_name: cursor.orgs?.[x.organization_id] || '', source_created_at: x.created_at || '',
    }));
    return { records, cursor: next('deals') };
  }
  // deals: e-mail/telefone vêm do primeiro contato já sincronizado.
  const keys = [...new Set(data.map((d: any) => d.contact_ids?.[0]).filter(Boolean).map((id: string) => `crm_contact:${id}`))];
  const contacts: Record<string, any> = {};
  if (keys.length) {
    const r = await base44.asServiceRole.entities.RdLead.filter({ external_key: { $in: keys } }, { limit: 500, fields: ['external_key', 'name', 'email', 'phone'] });
    for (const c of r.items || []) contacts[c.external_key] = c;
  }
  const m = cursor.maps || {};
  const records = data.map((x: any) => {
    const ct = contacts[`crm_contact:${x.contact_ids?.[0]}`] || {};
    return identity({
      external_key: `crm_deal:${x.id}`, product: 'crm_deal', external_id: String(x.id), name: x.name || ct.name || '',
      email: ct.email || '', phone: ct.phone || '', company_name: cursor.orgs?.[x.organization_id] || '',
      campaign: m.camp?.[x.campaign_id] || '', origin: m.source?.[x.source_id] || '',
      stage: m.stage?.[x.stage_id] || '', pipeline: m.pipe?.[x.pipeline_id] || '',
      deal_status: DEAL_STATUS[x.status] || 'open', amount: Number(x.total_price) || 0,
      owner: m.user?.[x.owner_id] || '', source_created_at: x.created_at || '', closed_at: x.closed_at || '',
      custom_sisloc_proposal: digits(x.custom_fields?.['n-proposta-sisloc']),
      ...(x.custom_fields && typeof x.custom_fields === 'object' ? normalizeCustomFields(x.custom_fields) : {}),
    });
  });
  return { records, cursor: next(null) };
}

async function marketingBearer(base44: any) {
  try { return await ensureAccessToken(base44); } catch { return await marketingAccessToken(); }
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
export function conversasWindows(months: number) {
  const end = new Date();
  const start = new Date(end); start.setMonth(start.getMonth() - months);
  const out: { s: string; e: string }[] = [];
  const c = new Date(start);
  while (c < end) {
    const stop = new Date(c); stop.setDate(stop.getDate() + 89);
    out.push({ s: iso(c), e: iso(stop > end ? end : stop) });
    c.setTime(stop.getTime()); c.setDate(c.getDate() + 1);
  }
  return out;
}

// Um passo de paginação. Retorna { records, cursor (null = terminou) }.
export async function fetchPage(product: string, cursor: any, base44: any) {
  assertActive(product);
  if (product === 'conversas') {
    const token = rdToken('conversas', 'RDSTATION_CONVERSAS_TOKEN');
    if (!token) throw new Error('Segredo RDSTATION_CONVERSAS_TOKEN ausente.');
    const w = cursor.wins[cursor.w];
    if (!w) return { records: [], cursor: null };
    const j = await getJson(`https://api.tallos.com.br/v4/reports?start_date=${w.s}&end_date=${w.e}&limit=50&page=${cursor.page}`,
      { Authorization: `Bearer ${token.trim()}` });
    const records = (j?.docs || []).map((d: any) => {
      const c = d.customer || {};
      const id = d._id || d.id || `${c.id || c.cel_phone}-${d.started_at || d.created_at}`;
      return identity({
        external_key: `conversas:${id}`, product: 'conversas', external_id: String(id),
        name: c.full_name || '', phone: c.cel_phone || '', email: c.email || '',
        origin: c.channel || d.channel || 'whatsapp', stage: d.to_tabulation || '',
        campaign: (c.tags || []).map((t: any) => (typeof t === 'string' ? t : t?.name)).filter(Boolean).join(', '),
        owner: d.employee?.name || '', source_created_at: d.started_at || d.created_at || '',
      });
    });
    const pages = Number(j?.pages) || 1;
    const next = cursor.page < pages ? { ...cursor, page: cursor.page + 1 } : { ...cursor, w: cursor.w + 1, page: 1 };
    return { records, cursor: next.w >= cursor.wins.length ? null : next };
  }

  if (product === 'crm') return await crmPage(cursor, base44);

  if (product === 'marketing') {
    const bearer = await marketingBearer(base44);
    const h = { Authorization: `Bearer ${bearer}`, Accept: 'application/json' };
    if (!cursor.segs) {
      const j = await getJson('https://api.rd.services/platform/segmentations?page=1&page_size=100', h);
      const segs = j?.segmentations || [];
      const all = segs.find((s: any) => /todos os contatos/i.test(s.name || ''));
      const chosen = (all ? [all] : segs).map((s: any) => ({ id: s.id, name: s.name }));
      return { records: [], cursor: chosen.length ? { segs: chosen, i: 0, page: 1 } : null };
    }
    const seg = cursor.segs[cursor.i];
    const j = await getJson(`https://api.rd.services/platform/segmentations/${seg.id}/contacts?page=${cursor.page}&page_size=125`, h);
    const list = j?.contacts || [];
    const records = list.map((c: any) => identity({
      external_key: `marketing:${c.uuid}`, product: 'marketing', external_id: c.uuid, name: c.name || '',
      email: c.email || '', phone: c.mobile_phone || c.personal_phone || '', campaign: seg.name,
      origin: 'RD Marketing', stage: c.lifecycle_stage || '', source_created_at: c.created_at || c.last_conversion_date || '',
    }));
    if (list.length === 125) return { records, cursor: { ...cursor, page: cursor.page + 1 } };
    return { records, cursor: cursor.i + 1 < cursor.segs.length ? { ...cursor, i: cursor.i + 1, page: 1 } : null };
  }
  throw new Error(`Produto desconhecido: ${product}`);
}

export function initialCursor(product: string, months: number) {
  if (product === 'conversas') return { wins: conversasWindows(months), w: 0, page: 1 };
  if (product === 'crm') return { phase: 'lookups', pagination_version: crmPaginationVersion };
  return {};
}