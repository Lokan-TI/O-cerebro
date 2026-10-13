// Matriz de achados: integração atual × documentação oficial RD (developers.rdstation.com), revisada em 13/10/2026.
const D = "https://developers.rdstation.com/reference/";

export const RD_FINDINGS = [
  { product: "CRM", area: "Credenciais", kind: "fixed", title: "Token de instância na URL (API v1)",
    detail: "A v1 exige o token do usuário em ?token=. Mantido, guardado só no servidor e mascarado nos registros.", doc: D + "crm-v1-introducao-e-requisitos" },
  { product: "CRM", area: "Teste", kind: "fixed", title: "Teste usa o endpoint oficial de checagem",
    detail: "Trocado de 'listar negociações' para token/check, que valida o token sem depender de permissão de visibilidade.", doc: D + "crm-v1-introducao-e-requisitos" },
  { product: "CRM", area: "Sincronização", kind: "fixed", title: "Limite de 10 mil registros por listagem",
    detail: "A paginação simples para em 10 mil. Negociações agora seguem o cursor next_page, em ordem de criação crescente.", doc: D + "crm-v1-list-deals" },
  { product: "CRM", area: "Sincronização", kind: "decision", title: "Contatos acima de 10 mil",
    detail: "A listagem de contatos v1 não tem cursor; acima de 10 mil é preciso a API v2 (OAuth) ou usar os contatos das negociações.", doc: D + "crm-v1-list-contacts" },
  { product: "Todos", area: "Limites", kind: "fixed", title: "120 requisições por minuto",
    detail: "Em erro 429 a sincronização agora espera de forma progressiva antes de repetir.", doc: D + "crm-v1-limite-de-requisicoes-da-api" },
  { product: "CRM", area: "Credenciais", kind: "decision", title: "API v2 usa OAuth, não token",
    detail: "Equipes, reuniões, propostas e webhooks de negociação só existem na v2, que exige app OAuth próprio.", doc: D + "crm-v2-authentication" },
  { product: "CRM", area: "Permissões", kind: "account", title: "Visibilidade do usuário dono do token",
    detail: "A RD devolve 404 quando o usuário do token não tem visibilidade do registro. Gere o token com um usuário administrador.", doc: D + "crm-v1-mensagens-de-erro" },
  { product: "Marketing", area: "Credenciais", kind: "fixed", title: "OAuth com renovação automática",
    detail: "Client ID, secret e refresh token ficam no servidor; o token de acesso é renovado a cada uso.", doc: D + "autenticação" },
  { product: "Marketing", area: "Sincronização", kind: "account", title: "Contatos via segmentação",
    detail: "A API não lista toda a base; usamos a segmentação 'Todos os contatos'. Ela precisa existir na conta.", doc: D + "get_platform-segmentations-id-contacts-1" },
  { product: "Conversas", area: "Dados", kind: "unsupported", title: "Conteúdo das mensagens",
    detail: "O histórico de mensagens exige chaves do plano Advanced; usamos o relatório de atendimentos.", doc: "https://developers.rdstation.com/llms.txt" },
  { product: "Todos", area: "Sincronização", kind: "decision", title: "Webhooks em tempo real",
    detail: "A RD oferece webhooks de CRM e Marketing; hoje a sincronização é sob demanda. Ativar exige decisão.", doc: D + "webhooks" },
];

export const KIND_LABEL = {
  fixed: ["Corrigido", "bg-emerald-500/15 text-emerald-300"],
  decision: ["Exige decisão", "bg-amber-500/15 text-amber-300"],
  account: ["Depende da conta", "bg-sky-500/15 text-sky-300"],
  unsupported: ["Sem suporte na RD", "bg-gray-500/20 text-gray-300"],
};