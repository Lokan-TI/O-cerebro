// Sincronização armazenada do RD Station (Marketing, CRM, Conversas) → entidade RdLead.
// Cada passo processa algumas páginas e devolve o cursor para retomar.
import { marketingAccessToken } from './rdStation.ts';
import { ensureAccessToken } from './rdOAuth.ts';
import { rdToken, assertActive } from './rdConfig.ts';

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

function crmHeaders() {
  const t = rdToken('crm', 'RDSTATION_CRM_TOKEN');
  if (!t) throw new Error('Segredo RDSTATION_CRM_TOKEN ausente.');
  return t.trim();
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

  if (product === 'crm') {
    const token = crmHeaders();
    const phase = cursor.phase || 'deals';
    // Doc CRM v1: limit máx. 200; listagem por página só alcança os 10 mil primeiros — negociações usam next_page para ir além.
    const q = cursor.next_page ? `next_page=${encodeURIComponent(cursor.next_page)}` : `page=${cursor.page}`;
    const j = await getJson(`https://crm.rdstation.com/api/v1/${phase}?${q}&limit=200&order=created_at&direction=asc&token=${encodeURIComponent(token)}`, {});
    const list = j?.[phase] || [];
    const records = list.map((x: any) => {
      const id = String(x.id || x._id);
      if (phase === 'deals') {
        const ct = (x.contacts || [])[0] || {};
        return identity({
          external_key: `crm_deal:${id}`, product: 'crm_deal', external_id: id, name: x.name || ct.name || '',
          email: ct.emails?.[0]?.email || '', phone: ct.phones?.[0]?.phone || '',
          company_name: x.organization?.name || '', campaign: x.campaign?.name || '', origin: x.deal_source?.name || '',
          stage: x.deal_stage?.name || '', pipeline: x.deal_pipeline?.name || x.deal_stage?.deal_pipeline?.name || '',
          deal_status: x.win === true ? 'won' : x.win === false ? 'lost' : 'open',
          amount: Number(x.amount_total) || 0, owner: x.user?.name || '', source_created_at: x.created_at || '',
        });
      }
      return identity({
        external_key: `crm_contact:${id}`, product: 'crm_contact', external_id: id, name: x.name || '',
        email: x.emails?.[0]?.email || '', phone: x.phones?.[0]?.phone || '',
        company_name: x.organization?.name || '', source_created_at: x.created_at || '',
      });
    });
    if (phase === 'deals' && j?.has_more && j?.next_page) return { records, cursor: { phase, page: cursor.page + 1, next_page: j.next_page } };
    if (j?.has_more && list.length) return { records, cursor: { phase, page: cursor.page + 1 } };
    return { records, cursor: phase === 'deals' ? { phase: 'contacts', page: 1 } : null };
  }

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
  if (product === 'crm') return { phase: 'deals', page: 1 };
  return {};
}