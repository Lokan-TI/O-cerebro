import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { RD_PRODUCTS, rdRead } from '../../shared/rdStation.ts';

// Gateway somente leitura para as APIs do RD Station (CRM, Marketing, Conversas).
// Sem catálogo → retorna o catálogo de recursos disponíveis (o que o Cérebro sabe ler).
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') {
      return Response.json({ error: 'Consulta a integrações restrita a administradores.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const product = body?.product || '';

    if (!product || body?.catalog_only) {
      return Response.json({
        catalog: Object.entries(RD_PRODUCTS).map(([key, cfg]: any) => ({
          product: key,
          label: cfg.label,
          base_url: cfg.base_url,
          auth: cfg.auth,
          endpoints: cfg.endpoints,
        })),
      });
    }

    const result = await rdRead(product, body?.endpoint || '', body?.params || {});
    return Response.json(result, { status: result.ok ? 200 : 502 });
  } catch (error) {
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
}