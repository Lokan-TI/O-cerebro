// OAuth 2.0 do RD Station CRM v2 (credenciais e tokens separados do Marketing).
// Doc: accounts.rdstation.com/oauth/authorize · api.rd.services/oauth2/token · access 2h · refresh rotativo (14 dias sem uso).
import { RD_OAUTH } from './rdOAuth.ts';

export const CRM_API = 'https://api.rd.services/crm/v2';
export const CRM_PROVIDER = 'rdstation_crm';
const AUTH_URL = 'https://accounts.rdstation.com/oauth/authorize';
const TOKEN_URL = 'https://api.rd.services/oauth2/token';

async function crmConn(base44: any) {
  const rows = await base44.asServiceRole.entities.RdApiConnection.filter({ product: 'crm' }, '-updated_date', 1).catch(() => []);
  return rows?.[0] || null;
}

async function credentials(base44: any) {
  const c = await crmConn(base44);
  const env = (n: string) => (c?.env_disabled ? '' : Deno.env.get(n) || '');
  const client_id = (c?.client_id || env('RDSTATION_CRM_CLIENT_ID')).trim();
  const client_secret = (c?.client_secret || env('RDSTATION_CRM_CLIENT_SECRET')).trim();
  if (!client_id || !client_secret) throw new Error('Cadastre o Client ID e o Client Secret do App RD CRM (etapa 2) antes de autorizar.');
  return { client_id, client_secret };
}

async function oauthRecord(base44: any) {
  const rows = await base44.asServiceRole.entities.RdStationOAuth.filter({ provider: CRM_PROVIDER });
  return rows?.[0] || null;
}

export async function crmAuthorizeUrl(base44: any, state: string) {
  const { client_id } = await credentials(base44);
  const url = new URL(AUTH_URL);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', client_id);
  url.searchParams.set('redirect_uri', RD_OAUTH.redirect_uri);
  url.searchParams.set('state', state);
  return url.toString();
}

async function postToken(base44: any, payload: Record<string, string>) {
  const form = new URLSearchParams({ ...(await credentials(base44)), ...payload });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: form.toString(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body?.access_token) {
    const hint = res.status === 400 || res.status === 401
      ? ' Confira se o Client ID/Secret são do App do CRM e se a URL de callback cadastrada é exatamente a mostrada no assistente. O código vale 5 minutos; se expirou, autorize de novo.'
      : '';
    throw new Error(`RD CRM recusou a autenticação (${res.status}): ${JSON.stringify(body).slice(0, 200)}.${hint}`);
  }
  return {
    access_token: body.access_token as string,
    refresh_token: (body.refresh_token as string) || '',
    expires_at: new Date(Date.now() + Number(body.expires_in || 7200) * 1000).toISOString(),
  };
}

export async function crmExchange(base44: any, code: string) {
  if (!code) throw new Error('Código de autorização ausente.');
  return await postToken(base44, { code, redirect_uri: RD_OAUTH.redirect_uri, grant_type: 'authorization_code' });
}

let inflight: Promise<string> | null = null;

// Access token válido; renova se faltar < 5 min (ou se forçado após 401). O novo par sempre substitui o anterior.
export async function crmAccessToken(base44: any, force = false): Promise<string> {
  const rec = await oauthRecord(base44);
  if (!rec?.refresh_token) throw new Error('Conta RD CRM não autorizada. Clique em "Autorizar na RD Station" (etapa 3).');
  const exp = rec.expires_at ? new Date(rec.expires_at).getTime() : 0;
  if (!force && exp - Date.now() > 5 * 60 * 1000) return rec.access_token;
  if (inflight) return inflight;
  inflight = (async () => {
    const db = base44.asServiceRole.entities.RdStationOAuth;
    try {
      const fresh = await postToken(base44, { refresh_token: rec.refresh_token, grant_type: 'refresh_token' });
      await db.update(rec.id, { ...fresh, refresh_token: fresh.refresh_token || rec.refresh_token, status: 'connected', last_error: '' });
      return fresh.access_token;
    } catch (e) {
      // Outra execução pode ter renovado em paralelo (refresh rotativo): usa o par mais recente se for válido.
      const again = await oauthRecord(base44);
      const againExp = again?.expires_at ? new Date(again.expires_at).getTime() : 0;
      if (again && again.refresh_token !== rec.refresh_token && againExp - Date.now() > 60 * 1000) return again.access_token;
      await db.update(rec.id, { status: 'error', last_error: e.message });
      throw new Error(`${e.message} Se o acesso ficou mais de 14 dias sem uso, autorize a conta novamente.`);
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

const HINTS: Record<number, string> = {
  401: 'Token recusado — autorize a conta RD CRM novamente',
  403: 'Sem permissão para este recurso (plano ou permissões do usuário que autorizou)',
  404: 'Recurso não encontrado na API CRM v2',
  429: 'Limite de requisições da RD atingido — retome em alguns minutos',
};

// GET na API v2 com renovação após 401 e espera por Retry-After em 429.
export async function crmGet(base44: any, path: string, params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = path.startsWith('http') ? path : `${CRM_API}/${path}${qs ? `?${qs}` : ''}`;
  let force = false;
  for (let attempt = 0; attempt < 4; attempt++) {
    const token = await crmAccessToken(base44, force);
    force = false;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, signal: AbortSignal.timeout(25000) });
    if (res.status === 401 && attempt === 0) { force = true; continue; }
    if (res.status === 429) {
      const wait = Math.min(Number(res.headers.get('Retry-After')) || 5 * (attempt + 1), 30);
      await new Promise((r) => setTimeout(r, wait * 1000));
      continue;
    }
    const txt = await res.text();
    if (!res.ok) throw new Error(`${HINTS[res.status] || 'Falha na API RD CRM'} (HTTP ${res.status}): ${txt.slice(0, 200)}`);
    return JSON.parse(txt || '{}');
  }
  throw new Error(HINTS[429]);
}