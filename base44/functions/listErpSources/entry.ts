import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const sources = await base44.asServiceRole.entities.ErpDataSource.list();
    // Never return the password to the frontend — only a boolean flag.
    const safe = sources.map((s) => {
      const { password, ...rest } = s;
      return { ...rest, has_password: !!password };
    });
    return Response.json({ sources: safe });
  } catch (error) {
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
});