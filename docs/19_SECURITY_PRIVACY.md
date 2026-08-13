# 19 — SECURITY & PRIVACY

Versão 1.0-draft · 2026-08-13

## Modelo de autorização
- **RBAC**: `executive`, `manager_commercial`, `manager_operations`, `finance`, `data_steward`, `data_engineer`, `admin`.
- **ABAC**: atributos `organization_id`, `branch_ids`, `source_scope` limitam o AnalysisContext permitido ao usuário.
- **Row-level security**: por organização e filial em toda entidade canônica e em toda release.
- **Field-level security**: campos PII e financeiros sensíveis só para papéis autorizados.

## Classificação de dados
| Classe | Exemplos |
|---|---|
| PUBLIC | nome de produto, categoria de equipamento |
| INTERNAL | métricas agregadas, ranking interno |
| CONFIDENTIAL | margem, custo, comissão |
| PII | CPF, RG, data de nascimento, filiação, telefone pessoal, e-mail pessoal, endereço residencial, observações livres |
| FINANCIAL_SENSITIVE | limite de crédito, inadimplência individual, exposição por cliente |
| SECRET | senhas de banco, API keys, tokens OAuth, certificados |

Campos identificados hoje como PII sem controle: `nr_cpf_pessoa`, `nr_ident_pessoa`, `dt_ani_pessoa`, `nm_pai`, `nm_mae`, telefones, e-mail, endereços e `obs_pessoa` (texto livre, pode conter dado sensível de inadimplência) — expostos em `listClientesCadastro` e na exportação de clientes.

## Regras
1. **Secret management**: credenciais somente por `secret_reference`; nunca campo de entidade; nunca retornadas ao front (corrige audit P0-01).
2. **Least privilege**: conexões analíticas com usuário READ ONLY na origem.
3. **Query arbitrária**: restrita ao papel `data_engineer`, em área administrativa, com allowlist de objetos, limite de linhas/tempo e log de auditoria. Validar "começa com SELECT" não é controle de segurança (corrige audit P0-02).
4. **Exportações**: toda exportação é auditada (quem, quando, quais campos, quantos registros, qual AnalysisContext) e mascara PII conforme o papel.
5. **Audit trail**: leitura de PII, exportação, execução de query, publicação de release, aprovação de mapping semântico e de métrica.
6. **Minimização**: exportação completa de cadastro exige justificativa e papel específico (`data_steward`), não deve ser ação padrão de tela executiva.