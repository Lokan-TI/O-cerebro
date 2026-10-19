import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Consulta o OpenCNPJ (dados públicos da Receita) para um lote de CNPJs já validados.
// Não grava nada: devolve apenas o resultado por CNPJ para o relatório de comparação.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Código IBGE do município (a Receita usa outro código): tabela por UF da BrasilAPI, cacheada por execução.
const norm = (s: string) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
const ibgeCache: Record<string, Promise<Record<string, string>>> = {};
async function ibgeCode(uf: string, city: string) {
  if (!uf || !city) return '';
  ibgeCache[uf] ||= fetch(`https://brasilapi.com.br/api/ibge/municipios/v1/${uf}`, { signal: AbortSignal.timeout(10000) })
    .then((r) => r.ok ? r.json() : [])
    .then((list: any[]) => Object.fromEntries(list.map((m) => [norm(m.nome), String(m.codigo_ibge)])))
    .catch(() => { delete ibgeCache[uf]; return {}; });
  return (await ibgeCache[uf])[norm(city)] || '';
}

async function lookup(cnpj: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`https://api.opencnpj.org/${cnpj}`, { signal: AbortSignal.timeout(10000) });
      if (res.status === 404) return { cnpj, status: 'not_found' };
      if (res.status === 429 || res.status >= 500) { await sleep(1000 * (attempt + 1)); continue; }
      if (!res.ok) return { cnpj, status: 'error', error: `HTTP ${res.status}` };
      const d = await res.json();
      if (String(d.cnpj || '').replace(/\D/g, '') !== cnpj) return { cnpj, status: 'error', error: 'CNPJ divergente na resposta' };
      const tel = (d.telefones || []).filter((t: any) => !t.is_fax).map((t: any) => `(${t.ddd}) ${t.numero}`);
      return {
        cnpj, status: 'ok',
        email: String(d.email || '').trim().toLowerCase(),
        razao_social: d.razao_social || '',
        nome_fantasia: d.nome_fantasia || '',
        situacao: d.situacao_cadastral || '',
        data_situacao: d.data_situacao_cadastral || '',
        matriz_filial: d.matriz_filial || '',
        data_abertura: d.data_inicio_atividade || '',
        cnae_principal: d.cnae_principal || '',
        cnae_descricao: (d.cnaes || []).find((c: any) => c.is_principal)?.descricao || '',
        natureza_juridica: [d.codigo_natureza_juridica, d.natureza_juridica].filter(Boolean).join(' - '),
        porte: d.porte_empresa || '',
        simples: d.opcao_simples || '',
        mei: d.opcao_mei || '',
        capital_social: d.capital_social || '',
        logradouro: [d.tipo_logradouro, d.logradouro].filter(Boolean).join(' '),
        numero: d.numero || '',
        complemento: String(d.complemento || '').replace(/\s+/g, ' ').trim(),
        bairro: d.bairro || '',
        cep: d.cep || '',
        municipio: d.municipio || '',
        uf: d.uf || '',
        codigo_municipio_receita: d.codigo_municipio || '',
        codigo_ibge: await ibgeCode(d.uf, d.municipio),
        telefone1: tel[0] || '',
        telefone2: tel[1] || '',
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