import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Consulta o OpenCNPJ (dados públicos da Receita) para um lote de CNPJs já validados.
// Não grava nada: devolve apenas o resultado por CNPJ para o relatório de comparação.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function lookup(cnpj: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`https://api.opencnpj.org/${cnpj}`, { signal: AbortSignal.timeout(10000) });
      if (res.status === 404) return { cnpj, status: 'not_found' };
      if (res.status === 429 || res.status >= 500) { await sleep(1000 * (attempt + 1)); continue; }
      if (!res.ok) return { cnpj, status: 'error', error: `HTTP ${res.status}` };
      const d = await res.json();
      if (String(d.cnpj || '').replace(/\D/g, '') !== cnpj) return { cnpj, status: 'error', error: 'CNPJ divergente na resposta' };
      return {
        cnpj, status: 'ok',
        email: String(d.email || '').trim().toLowerCase(),
        razao_social: d.razao_social || '',
        situacao: d.situacao_cadastral || '',
      };
    } catch (e) {
      if (attempt === 2) return { cnpj, status: 'error', error: (e as Error).message };
      await sleep(800 * (attempt + 1));
    }
  }
  return { cnpj, status: 'error', error: 'Limite de consultas atingido' };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const cnpjs: string[] = (body?.cnpjs || []).map((c: any) => String(c).replace(/\D/g, '')).filter((c: string) => c.length === 14).slice(0, 25);
    const results: any[] = [];
    for (let i = 0; i < cnpjs.length; i += 5) {
      results.push(...await Promise.all(cnpjs.slice(i, i + 5).map(lookup)));
    }
    return Response.json({ results });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});