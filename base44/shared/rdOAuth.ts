// Fluxo OAuth 2.0 do RD Station (app criado no Portal do Desenvolvedor).
// O Cérebro guarda access_token + refresh_token e renova sozinho quando expira.

export const RD_OAUTH = {
  dialog_url: 'https://api.rd.services/auth/dialog',
  token_url: 'https://api.rd.services/auth/token',
  redirect_uri: 'https://lokan-firstouch.base44.app/rdstation/callback',
};

function credentials() {
  const client_id = Deno.env.get('RDSTATION_CRM_CLIENT_ID');
  const client_secret = Deno.env.get('RDSTATION_CRM_CLIENT_SECRET');
  if (!client_id || !client_secret) {
    throw new Error('Credenciais do app RD Station ausentes (Client ID / Client Secret).');
  }
  return { client_id, client_secret };
}

export function authorizeUrl(): string {
  const { client_id } = credentials();
  const url = new URL(RD_OAUTH.dialog_url);
  url.searchParams.set('client_id', client_id);
  url.searchParams.set('redirect_uri', RD_OAUTH.redirect_uri);
  return url.toString();
}

async function postToken(payload: Record<string, string>) {
  const res = await fetch(RD_OAUTH.token_url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ ...credentials(), ...payload }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body?.access_token) {
    throw new Error(
      `RD Station recusou a autenticação (${res.status}): ${JSON.stringify(body).slice(0, 300)}`,
    );
  }
  const expiresIn = Number(body.expires_in || 86400);
  return {
    access_token: body.access_token as string,
    refresh_token: (body.refresh_token as string) || '',
    expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
  };
}

export async function exchangeCode(code: string) {
  if (!code) throw new Error('Código de autorização ausente.');
  return await postToken({ code });
}

export async function refreshAccessToken(refresh_token: string) {
  if (!refresh_token) throw new Error('Refresh token ausente. Reconecte a conta RD Station.');
  return await postToken({ refresh_token });
}

// Retorna um access_token válido, renovando quando faltar menos de 5 minutos.
export async function ensureAccessToken(base44: any): Promise<string> {
  const records = await base44.asServiceRole.entities.RdStationOAuth.filter({ provider: 'rdstation' });
  const record = records?.[0];
  if (!record?.access_token) throw new Error('Conta RD Station não conectada.');

  const expiresAt = record.expires_at ? new Date(record.expires_at).getTime() : 0;
  if (expiresAt - Date.now() > 5 * 60 * 1000) return record.access_token;

  const fresh = await refreshAccessToken(record.refresh_token);
  await base44.asServiceRole.entities.RdStationOAuth.update(record.id, {
    access_token: fresh.access_token,
    refresh_token: fresh.refresh_token || record.refresh_token,
    expires_at: fresh.expires_at,
    status: 'connected',
    last_error: '',
  });
  return fresh.access_token;
}