// Consulta de CNPJ na base pública processada pelo OpenCNPJ (dados abertos da Receita Federal),
// com alternativa na BrasilAPI quando o OpenCNPJ limita as consultas. Não é consulta oficial em tempo real.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

// Dígitos verificadores do CNPJ (mesma regra usada pela Receita).
export function validCnpj(c: string) {
  if (!/^\d{14}$/.test(c) || /^(\d)\1+$/.test(c)) return false;
  const dv = (base: string) => {
    let s = 0, w = base.length - 7;
    for (const ch of base) { s += Number(ch) * w--; if (w < 2) w = 9; }
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = dv(c.slice(0, 12));
  return d1 === Number(c[12]) && dv(c.slice(0, 12) + d1) === Number(c[13]);
}

export async function lookupCnpj(cnpj: string): Promise<any> {
  let lastErr = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`https://api.opencnpj.org/${cnpj}`, { signal: AbortSignal.timeout(8000) });
      if (res.status === 404) return { cnpj, status: 'not_found', fonte: 'OpenCNPJ' };
      if (res.status === 429) { lastErr = 'OpenCNPJ limitou as consultas (HTTP 429)'; break; }
      if (res.status >= 500) { lastErr = `OpenCNPJ indisponível (HTTP ${res.status})`; await sleep(1500 * (attempt + 1)); continue; }
      if (!res.ok) return { cnpj, status: 'error', fonte: 'OpenCNPJ', error: `HTTP ${res.status}` };
      const d = await res.json();
      if (String(d.cnpj || '').replace(/\D/g, '') !== cnpj) return { cnpj, status: 'error', fonte: 'OpenCNPJ', error: 'CNPJ divergente na resposta' };
      const tel = (d.telefones || []).filter((t: any) => !t.is_fax).map((t: any) => `(${t.ddd}) ${t.numero}`);
      return {
        cnpj, status: 'ok', fonte: 'OpenCNPJ', anonimizado: d.lgpd_anonimizado === true,
        email: String(d.email || '').trim().toLowerCase(),
        razao_social: d.razao_social || '', nome_fantasia: d.nome_fantasia || '',
        situacao: d.situacao_cadastral || '', data_situacao: d.data_situacao_cadastral || '',
        matriz_filial: d.matriz_filial || '', data_abertura: d.data_inicio_atividade || '',
        cnae_principal: d.cnae_principal || '',
        cnae_descricao: (d.cnaes || []).find((c: any) => c.is_principal)?.descricao || '',
        natureza_juridica: [d.codigo_natureza_juridica, d.natureza_juridica].filter(Boolean).join(' - '),
        porte: d.porte_empresa || '', simples: d.opcao_simples || '', mei: d.opcao_mei || '',
        capital_social: d.capital_social || '',
        logradouro: [d.tipo_logradouro, d.logradouro].filter(Boolean).join(' '),
        numero: d.numero || '', complemento: String(d.complemento || '').replace(/\s+/g, ' ').trim(),
        bairro: d.bairro || '', cep: d.cep || '', municipio: d.municipio || '', uf: d.uf || '',
        codigo_municipio_receita: d.codigo_municipio || '',
        codigo_ibge: await ibgeCode(d.uf, d.municipio).catch(() => ''),
        telefone1: tel[0] || '', telefone2: tel[1] || '',
      };
    } catch (e) {
      lastErr = (e as Error).name === 'TimeoutError' ? 'OpenCNPJ não respondeu (tempo esgotado)' : `OpenCNPJ: ${(e as Error).message}`;
      if (attempt === 1) break;
      await sleep(1500 * (attempt + 1));
    }
  }
  return await brasilApi(cnpj, lastErr);
}

async function brasilApi(cnpj: string, prevErr = '') {
  const pre = prevErr ? `${prevErr}; ` : '';
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, { signal: AbortSignal.timeout(10000) });
    if (res.status === 404) return { cnpj, status: 'not_found', fonte: 'BrasilAPI' };
    if (!res.ok) return { cnpj, status: 'error', fonte: 'BrasilAPI', error: `${pre}BrasilAPI ${res.status === 429 ? 'limitou as consultas' : 'falhou'} (HTTP ${res.status})` };
    const d = await res.json();
    const yn = (v: any) => v === true ? 'S' : v === false ? 'N' : '';
    const tel = (v: string) => { const t = String(v || '').replace(/\D/g, ''); return t ? `(${t.slice(0, 2)}) ${t.slice(2)}` : ''; };
    return {
      cnpj, status: 'ok', fonte: 'BrasilAPI', anonimizado: false,
      email: String(d.email || '').trim().toLowerCase(),
      razao_social: d.razao_social || '', nome_fantasia: d.nome_fantasia || '',
      situacao: d.descricao_situacao_cadastral || '', data_situacao: d.data_situacao_cadastral || '',
      matriz_filial: d.descricao_identificador_matriz_filial || '', data_abertura: d.data_inicio_atividade || '',
      cnae_principal: String(d.cnae_fiscal || ''), cnae_descricao: d.cnae_fiscal_descricao || '',
      natureza_juridica: [d.codigo_natureza_juridica, d.natureza_juridica].filter(Boolean).join(' - '),
      porte: d.porte || '', simples: yn(d.opcao_pelo_simples), mei: yn(d.opcao_pelo_mei),
      capital_social: String(d.capital_social ?? ''),
      logradouro: [d.descricao_tipo_de_logradouro, d.logradouro].filter(Boolean).join(' '),
      numero: d.numero || '', complemento: String(d.complemento || '').replace(/\s+/g, ' ').trim(),
      bairro: d.bairro || '', cep: d.cep || '', municipio: d.municipio || '', uf: d.uf || '',
      codigo_municipio_receita: String(d.codigo_municipio || ''), codigo_ibge: String(d.codigo_municipio_ibge || ''),
      telefone1: tel(d.ddd_telefone_1), telefone2: tel(d.ddd_telefone_2),
    };
  } catch (e) {
    return { cnpj, status: 'error', fonte: 'BrasilAPI', error: `${pre}BrasilAPI ${(e as Error).name === 'TimeoutError' ? 'não respondeu (tempo esgotado)' : (e as Error).message}` };
  }
}

// Uma consulta por vez, com pausa entre elas, para não acionar o limite das fontes públicas.
export async function lookupBatch(cnpjs: string[]) {
  const results: any[] = [];
  for (let i = 0; i < cnpjs.length; i++) {
    if (i) await sleep(400);
    results.push(await lookupCnpj(cnpjs[i]));
  }
  return results;
}