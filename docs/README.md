# O CÉREBRO · Documentação fundamental

Modelo de trabalho: **documentation-first**.
`Discovery → Documentation → Architecture Decision → Data Contract → Business Rule → Tests → Implementation → Reconciliation → Release`

## Estado do programa
Phase 0 (Freeze & Audit) e Phase 1 (Product Constitution) **entregues como documentação**. Implementação arquitetural ampla **não iniciada** — depende das aprovações listadas abaixo.

## Documentos publicados
| Doc | Conteúdo |
|---|---|
| [00_PRODUCT_CHARTER](00_PRODUCT_CHARTER.md) | missão, papéis, princípios, escopo, definição de pronto |
| [01_CURRENT_STATE_AUDIT](01_CURRENT_STATE_AUDIT.md) | inventário, findings P0–P3, métricas com definição concorrente |
| [02_RISK_REGISTER](02_RISK_REGISTER.md) | riscos arquiteturais e de dados |
| [03_DOMAIN_MODEL](03_DOMAIN_MODEL.md) | modelo canônico inicial e cobertura real |
| [04_TARGET_ARCHITECTURE](04_TARGET_ARCHITECTURE.md) | planos arquiteturais e DatasetRelease |
| [06_SOURCE_DISCOVERY](06_SOURCE_DISCOVERY.md) | onboarding semântico de fontes |
| [07_SOURCE_SEMANTIC_MODEL](07_SOURCE_SEMANTIC_MODEL.md) | modelo semântico da fonte Lokan (proposta) |
| [09_IDENTITY_RESOLUTION](09_IDENTITY_RESOLUTION.md) | MDM e entity resolution |
| [10_CUSTOMER_LIFECYCLE](10_CUSTOMER_LIFECYCLE.md) | máquina de estados única do cliente |
| [12_METRIC_REGISTRY](12_METRIC_REGISTRY.md) | registro corporativo de métricas |
| [13_ANALYSIS_CONTEXT](13_ANALYSIS_CONTEXT.md) | contrato único de análise |
| [15_DATA_QUALITY](15_DATA_QUALITY.md) | regras e quality gates |
| [17_BENCHMARK_GOVERNANCE](17_BENCHMARK_GOVERNANCE.md) | governança de benchmark |
| [18_AI_ADVISOR_CONTRACT](18_AI_ADVISOR_CONTRACT.md) | agente de decisão e guardrails |
| [19_SECURITY_PRIVACY](19_SECURITY_PRIVACY.md) | RBAC/ABAC, PII, secrets |
| [21_MIGRATION_PLAN](21_MIGRATION_PLAN.md) | fases 0 a 9 |
| [23_ADR_INDEX](23_ADR_INDEX.md) | decisões arquiteturais |
| [24_GLOSSARY](24_GLOSSARY.md) | glossário empresarial com anti-definições |

Pendentes (fases posteriores): 05, 08, 11, 14, 16, 20, 22 e diagramas C4/lineage.

## O que precisa de decisão do negócio antes da implementação
1. **Fonte da verdade da receita** — qual relatório/campo é oficial; impostos, frete, serviços, devolução e estorno.
2. **Lifecycle do cliente** — janelas (90/180/365) e as 5 exceções do doc 10.
3. **Evento de ativação da locação** — ficha, remessa liberada ou saída física.
4. **Mapeamento oficial de empresa/filial** (`cd_empresa`).
5. **Regra de atribuição de vendedor** por NF.
6. **Owners de negócio** por métrica do doc 12.
7. **Política de PII** — quem pode ver e exportar CPF, RG, filiação, telefone e observações.

Sem essas respostas, as métricas afetadas permanecem **NÃO OFICIAIS** e não devem sustentar decisão executiva.