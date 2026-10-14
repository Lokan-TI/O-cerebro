// Fluxo OAuth 2.0 oficial do RD Station Marketing (App criado na RD App Store / Portal do Desenvolvedor).
// Credenciais do App: as salvas no Cérebro vencem os segredos de ambiente RDSTATION_MARKETING_*.

export const RD_OAUTH = {
  dialog_url: 'https://api.rd.services/auth/dialog',
  token_url: 'https://api.rd.services/auth/token',
  redirect_uri: 'https://lokan-firstouch.base44.app/rdstation/callback',
};

async function marketingConn(base44: any) {
  const rows = await base44.asServiceRole.entities.RdApiConnection.filter({ product: 'marketing' }, '-updated_date', 1).catch(() => []);
  return rows?.[0] || null;
}

async function credentials(base44: any) {
  const c = await marketingConn(base44);
  const env = (n: string) => (c?.env_disabled ? '' : Deno.env.get(n) || '');
  const client_id = (c?.client_id || env('RDSTATION_MARKETING_CLIENT_ID')).trim();
  const client_secret = (c?.client_secret || env('RDSTATION_MARKETING_CLIENT_SECRET')).trim();
  if (!client_id || !client_secret) {
    throw new Error('Cadastre o Client ID e o Client Secret do App RD (etapa 2) antes de autorizar.');
  }
  return { client_id, client_secret };
}

export async function authorizeUrl(base44: any, state: string): Promise<string> {
  const { client_id } = await credentials(base44);
  const url = new URL(RD_OAUTH.dialog_url);
  url.searchParams.set('client_id', client_id);
  url.searchParams.set('redirect_uri', RD_OAUTH.redirect_uri);
  url.searchParams.set('state', state);
  // Pede nova autenticação em vez de reutilizar a sessão RD aberta no navegador.
  url.searchParams.set('prompt', 'login');
  return url.toString();
}

async function postToken(base44: any, payload: Record<string, string>) {
  // Doc oficial: troca do code usa /auth/token?token_by=code; renovação usa /auth/token com refresh_token.
  const url = payload.code ? `${RD_OAUTH.token_url}?token_by=code` : RD_OAUTH.token_url;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ ...(await credentials(base44)), ...payload, ...(payload.code ? { redirect_uri: RD_OAUTH.redirect_uri } : {}) }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body?.access_token) {
    const hint = res.status === 401 || res.status === 400
      ? ' Confira se o Client ID/Secret são do mesmo App e se a URL de callback cadastrada na RD é exatamente a mostrada no assistente.'
      : '';
    throw new Error(`RD Station recusou a autenticação (${res.status}): ${JSON.stringify(body).slice(0, 200)}.${hint}`);
  }
  const expiresIn = Number(body.expires_in || 86400);
  return {
    access_token: body.access_token as string,
    refresh_token: (body.refresh_token as string) || '',
    expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
  };
}

// Troca o código e guarda o refresh token também na conexão Marketing (usada pela sincronização).
export async function exchangeCode(base44: any, code: string) {
  if (!code) throw new Error('Código de autorização ausente.');
  const tokens = await postToken(base44, { code });
  const c = await marketingConn(base44);
  if (c && tokens.refresh_token) {
    await base44.asServiceRole.entities.RdApiConnection.update(c.id, {
      token: tokens.refresh_token, token_updated_at: new Date().toISOString(), removed: false, removed_at: null,
    });
  }
  return tokens;
}

export async function refreshAccessToken(base44: any, refresh_token: string) {
  if (!refresh_token) throw new Error('Refresh token ausente. Autorize a conta RD Station novamente.');
  return await postToken(base44, { refresh_token });
}

// Retorna um access_token válido, renovando quando faltar menos de 5 minutos.
export async function ensureAccessToken(base44: any): Promise<string> {
  const records = await base44.asServiceRole.entities.RdStationOAuth.filter({ provider: 'rdstation' });
  const record = records?.[0];
  if (!record?.access_token) throw new Error('Conta RD Station Marketing não autorizada.');

  const expiresAt = record.expires_at ? new Date(record.expires_at).getTime() : 0;
  if (expiresAt - Date.now() > 5 * 60 * 1000) return record.access_token;

  const fresh = await refreshAccessToken(base44, record.refresh_token);
  await base44.asServiceRole.entities.RdStationOAuth.update(record.id, {
    access_token: fresh.access_token,
    refresh_token: fresh.refresh_token || record.refresh_token,
    expires_at: fresh.expires_at,
    status: 'connected',
    last_error: '',
  });
  return fresh.access_token;
}