import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { authorizeUrl, exchangeCode, ensureAccessToken, RD_OAUTH } from '../../shared/rdOAuth.ts';

const STATE_TTL_MS = 15 * 60 * 1000;

// Gerencia a conexão OAuth com o RD Station. "start" (admin) gera um state de uso único;
// "exchange" é chamado pela aba de retorno e só é aceito com esse state válido.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = body?.action || 'status';
    const db = base44.asServiceRole.entities.RdStationOAuth;
    const records = await db.filter({ provider: 'rdstation' });
    const record = records?.[0] || null;

    if (action === 'exchange') {
      const state = String(body?.state || '');
      const expires = record?.oauth_state_expires_at ? new Date(record.oauth_state_expires_at).getTime() : 0;
      if (!record || !state || state !== record.oauth_state || expires < Date.now()) {
        return Response.json({ error: 'Link de autorização inválido ou expirado. Inicie a conexão novamente pela tela de Integrações.' }, { status: 400 });
      }
      // Consome o state antes da troca (uso único).
      await db.update(record.id, { oauth_state: '', oauth_state_expires_at: null });
      try {
        const tokens = await exchangeCode(String(body?.code || ''));
        await db.update(record.id, {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: tokens.expires_at,
          status: 'connected',
          last_error: '',
          connected_at: new Date().toISOString(),
        });
        return Response.json({ status: 'connected', expires_at: tokens.expires_at });
      } catch (err) {
        await db.update(record.id, { status: 'error', last_error: err.message });
        return Response.json({ error: err.message }, { status: 400 });
      }
    }

    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Acesso restrito a administradores' }, { status: 403 });

    if (action === 'start') {
      const state = crypto.randomUUID();
      const patch = {
        oauth_state: state,
        oauth_state_expires_at: new Date(Date.now() + STATE_TTL_MS).toISOString(),
        oauth_started_by: user.email,
      };
      if (record) await db.update(record.id, patch);
      else await db.create({ provider: 'rdstation', status: 'disconnected', ...patch });
      return Response.json({ authorize_url: authorizeUrl(state), state, redirect_uri: RD_OAUTH.redirect_uri });
    }

    if (action === 'check') {
      try {
        const token = await ensureAccessToken(base44);
        const res = await fetch('https://api.rd.services/marketing/account_info', {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        });
        const data = await res.json().catch(() => ({}));
        return Response.json({ ok: res.ok, http_status: res.status, account: data });
      } catch (err) {
        return Response.json({ error: err.message }, { status: 400 });
      }
    }

    return Response.json({
      status: record?.status || 'disconnected',
      expires_at: record?.expires_at || null,
      connected_at: record?.connected_at || null,
      last_error: record?.last_error || null,
      redirect_uri: RD_OAUTH.redirect_uri,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}