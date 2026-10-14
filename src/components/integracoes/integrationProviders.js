export const PROVIDERS = [
  {
    value: "rdstation_crm", label: "RD Station CRM", url: "https://crm.rdstation.com/api/v1", urlEditable: false,
    auths: ["api_key"], keyLabel: "Token da instância (CRM → Perfil → Token)", accountLabel: null,
    namePlaceholder: "Ex.: RD Station CRM — Matriz",
  },
  {
    value: "rdstation_marketing", label: "RD Station Marketing", url: "https://api.rd.services", urlEditable: false,
    auths: ["oauth"], keyLabel: "Client secret do app RD", accountLabel: "Client ID do app RD",
    namePlaceholder: "Ex.: RD Station Marketing",
  },
  {
    value: "erp_api", label: "ERP via API", url: "", urlEditable: true,
    auths: ["api_key", "bearer_token"], keyLabel: "Chave / token do ERP", accountLabel: "Código da empresa / filial (opcional)",
    namePlaceholder: "Ex.: TOTVS — Matriz",
  },
  {
    value: "outro", label: "Outro sistema", url: "", urlEditable: true,
    auths: ["api_key", "bearer_token", "oauth"], keyLabel: "Chave / token", accountLabel: "Conta / identificador (opcional)",
    namePlaceholder: "Ex.: Sistema de atendimento",
  },
];

export const AUTH_LABELS = { api_key: "API Key", bearer_token: "Bearer Token", oauth: "OAuth" };

export const getProvider = (v) => PROVIDERS.find((p) => p.value === v) || PROVIDERS[0];