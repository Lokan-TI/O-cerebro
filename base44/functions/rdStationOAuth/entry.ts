import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { authorizeUrl, exchangeCode, ensureAccessToken, RD_OAUTH } from '../../shared/rdOAuth.ts';

// Gerencia a conexão OAuth com o RD Station: gera o link de autorização,
// troca o código por token e informa o status da conta conectada.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Acesso restrito a administradores' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const action = body?.action || 'status';

    const records = await base44.asServiceRole.entities.RdStationOAuth.filter({ provider: 'rdstation' });
    const record = records?.[0] || null;

    if (action === 'start') {
      return Response.json({ authorize_url: authorizeUrl(), redirect_uri: RD_OAUTH.redirect_uri });
    }

    if (action === 'exchange') {
      try {
        const tokens = await exchangeCode(String(body?.code || ''));
        const payload = {
          provider: 'rdstation',
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: tokens.expires_at,
          status: 'connected',
          last_error: '',
          connected_at: new Date().toISOString(),
        };
        const saved = record
          ? await base44.asServiceRole.entities.RdStationOAuth.update(record.id, payload)
          : await base44.asServiceRole.entities.RdStationOAuth.create(payload);
        return Response.json({ status: 'connected', expires_at: saved.expires_at });
      } catch (err) {
        if (record) {
          await base44.asServiceRole.entities.RdStationOAuth.update(record.id, {
            status: 'error',
            last_error: err.message,
          });
        }
        return Response.json({ error: err.message }, { status: 400 });
      }
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