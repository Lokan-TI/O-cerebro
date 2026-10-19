import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { lookupBatch } from '../../shared/openCnpj.ts';

// Consulta a base pública (OpenCNPJ/BrasilAPI) para um lote de CNPJs já validados. Não grava nada.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const cnpjs: string[] = (body?.cnpjs || []).map((c: any) => String(c).replace(/\D/g, '')).filter((c: string) => c.length === 14).slice(0, 25);
    return Response.json({ results: await lookupBatch(cnpjs) });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});