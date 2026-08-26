// Camada de acesso somente leitura às APIs do RD Station (CRM, Marketing e Conversas).
// Aqui o Cérebro "aprende" como cada plataforma autentica e quais recursos pode ler,
// da mesma forma que já conhece o dicionário de dados do ERP.

export const RD_PRODUCTS = {
  crm: {
    label: 'RD Station CRM',
    base_url: 'https://crm.rdstation.com/api/v1',
    auth: 'Token na query string (?token=)',
    secret: 'RDSTATION_CRM_TOKEN',
    endpoints: [
      { path: 'token/check', label: 'Checar token', description: 'Valida o token da conta.' },
      { path: 'deals', label: 'Negociações', description: 'Oportunidades do funil de vendas.' },
      { path: 'deal_pipelines', label: 'Funis', description: 'Funis de vendas cadastrados.' },
      { path: 'deal_stages', label: 'Etapas do funil', description: 'Etapas de cada funil.' },
      { path: 'deal_lost_reasons', label: 'Motivos de perda', description: 'Motivos de perda de negociação.' },
      { path: 'contacts', label: 'Contatos', description: 'Contatos do CRM.' },
      { path: 'organizations', label: 'Empresas', description: 'Organizações/empresas do CRM.' },
      { path: 'users', label: 'Usuários', description: 'Vendedores e usuários da conta.' },
      { path: 'tasks', label: 'Tarefas', description: 'Atividades e tarefas registradas.' },
      { path: 'products', label: 'Produtos', description: 'Produtos vinculados às negociações.' },
    ],
  },
  marketing: {
    label: 'RD Station Marketing',
    base_url: 'https://api.rd.services',
    auth: 'OAuth 2.0 (refresh token → access token Bearer)',
    secret: 'RDSTATION_MARKETING_CLIENT_ID',
    endpoints: [
      { path: 'marketing/account_info', label: 'Dados da conta', description: 'Confirma a conta conectada.' },
      { path: 'platform/analytics/funnel', label: 'Funil de vendas', description: 'Visitantes, leads, oportunidades e vendas.' },
      { path: 'platform/analytics/conversions', label: 'Ativos de conversão', description: 'Desempenho dos ativos de conversão.' },
      { path: 'platform/analytics/emails', label: 'E-mail marketing', description: 'Engajamento das campanhas de e-mail.' },
      { path: 'platform/analytics/workflow_emails', label: 'E-mails de fluxo', description: 'Desempenho de e-mails de automação.' },
      { path: 'platform/contacts/fields', label: 'Campos de contato', description: 'Campos padrão e personalizados.' },
      { path: 'platform/segmentations', label: 'Segmentações', description: 'Listas de segmentação de leads.' },
    ],
  },
  conversas: {
    label: 'RD Station Conversas',
    base_url: 'https://api.tallos.com.br/v2',
    auth: 'Bearer JWT da conta',
    secret: 'RDSTATION_CONVERSAS_TOKEN',
    endpoints: [
      { path: 'employees', label: 'Atendentes', description: 'Usuários/atendentes da conta.' },
      { path: 'contacts', label: 'Contatos', description: 'Contatos de WhatsApp.' },
      { path: 'chats', label: 'Conversas', description: 'Conversas de WhatsApp.' },
      { path: 'tags', label: 'Tags', description: 'Tags aplicadas às conversas.' },
    ],
  },
};

function requireSecret(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(
      `Credencial ausente: o segredo ${name} não está configurado. Cadastre-o nas variáveis de ambiente do app.`,
    );
  }
  return value;
}

async function marketingAccessToken(): Promise<string> {
  const res = await fetch('https://api.rd.services/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: requireSecret('RDSTATION_MARKETING_CLIENT_ID'),
      client_secret: requireSecret('RDSTATION_MARKETING_CLIENT_SECRET'),
      refresh_token: requireSecret('RDSTATION_MARKETING_REFRESH_TOKEN'),
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body?.access_token) {
    throw new Error(`Falha ao autenticar no RD Station Marketing (${res.status}): ${JSON.stringify(body).slice(0, 300)}`);
  }
  return body.access_token;
}

// Leitura genérica: sempre GET, sempre em um recurso do produto escolhido.
export async function rdRead(
  product: string,
  path: string,
  params: Record<string, unknown> = {},
  bearer?: string,
) {
  const cfg = (RD_PRODUCTS as any)[product];
  if (!cfg) throw new Error(`Produto RD Station desconhecido: ${product}`);

  const clean = String(path || '').replace(/^\/+/, '').split('?')[0];
  if (!clean || clean.includes('..')) throw new Error('Recurso inválido.');

  const url = new URL(`${cfg.base_url}/${clean}`);
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (product === 'crm') {
    url.searchParams.set('token', requireSecret('RDSTATION_CRM_TOKEN'));
  } else if (product === 'marketing') {
    // Preferimos o acesso OAuth conectado pelo app do Cérebro; se não houver, caímos no refresh token legado.
    headers.Authorization = `Bearer ${bearer || (await marketingAccessToken())}`;
  } else {
    headers.Authorization = `Bearer ${requireSecret('RDSTATION_CONVERSAS_TOKEN')}`;
  }

  const started = Date.now();
  const res = await fetch(url.toString(), { method: 'GET', headers });
  const text = await res.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = text.slice(0, 2000); }

  return {
    ok: res.ok,
    status: res.status,
    product,
    label: cfg.label,
    endpoint: clean,
    // URL sem credencial, para auditoria/exibição
    request_url: url.toString().replace(/token=[^&]+/, 'token=***'),
    duration_ms: Date.now() - started,
    data,
  };
}