# 21 — MIGRATION PLAN

Versão 1.0-draft · 2026-08-13
Sem Big Bang. Legado e nova arquitetura coexistem. Nenhuma substituição de métrica sem reconciliação aprovada.

## Phase 0 — Freeze & Audit *(em execução)*
- Congelar criação de novos dashboards, abas e métricas.
- Publicar `01_CURRENT_STATE_AUDIT` (feito).
- Corrigir P0: credencial em entidade, SQL arbitrário na experiência analítica, publicação não atômica, definições concorrentes de churn, dependência da data atual.
- Marcar telas atuais com selo **NÃO OFICIAL**.
- Saída: P0 resolvidos ou com prazo aprovado.

## Phase 1 — Product Constitution *(entregue neste conjunto de documentos)*
Charter, Domain Model, Target Architecture, Customer Lifecycle, Metric Registry, Analysis Context, Security Model, Glossary, Risk Register.
Saída: aprovação de owners de negócio por métrica e por lifecycle.

## Phase 2 — Source Discovery Engine
Inventory + dicionário + profiling + PII persistidos por fonte; `SourceSemanticContract` da Lokan aprovado; drift monitor ativo.
Saída: Source Onboarding Report com Trust Score.

## Phase 3 — Canonical Data Platform
Raw plane com lineage por registro; Party/PartyRole; Invoice/Receivable/Payable; RentalContract/Dispatch; identity resolution determinística; eventos de cliente.
Saída: contagem de clientes e receita reproduzíveis a partir do canônico.

## Phase 4 — Semantic Layer *(em execução)*
Entregue: registry executável + `computeMetric` (AnalysisContext obrigatório, selo de confiança e linhagem SQL por resultado) cobrindo MTR-001, 006, 007 e 017 · aba admin "Camada Semântica".
Entregue: reconciliação legado × canônico persistida (`reconcileMetrics` + `MetricReconciliation`, aba admin "Recon. Métricas") — Receita aderente a 0%, divergências de contagem de clientes justificadas e aceitas.
Entregue: `DatasetRelease` atômico (`publishDatasetRelease` + entidade `DatasetRelease`, aba admin "Publicação (Release)"). A release congela snapshot, versões do registry e a reconciliação, e **só publica** com todos os portões aprovados:
1. snapshot vigente publicado · 2. reconciliação apurada no ano · 3. divergências > 2% justificadas e aceitas · 4. cobertura de documento do Party ≥ 95% · 5. trust score da fonte ≥ 60.
A troca é atômica: a release anterior só é rebaixada a `superseded` quando a nova passa em todos os portões; reprovada, grava-se `blocked` com os motivos e a vigente permanece.
Entregue: registry ampliado com MTR-018 (NFs faturadas) e MTR-019 (novos clientes faturados).
Entregue: métricas de Recebíveis/DSO no registry (MTR-020 em aberto, MTR-021 vencidos, MTR-022 DSO) — sem contraparte legada direta (janelas distintas), reconciliadas como SEM LEGADO.
Entregue: ADR-010 (aprovação de métricas pelo CFO) redigido e em AWAITING_APPROVAL — lista as questões bloqueantes por métrica; a assinatura vira `trusted = true` e remove o selo NÃO OFICIAL.
Entregue: Customer Lifecycle v1 como serviço único (`computeLifecycle`, doc 10 passos 1–2) — atividade por NF, as_of explícito, rodando em paralelo ao motor legado por remessa na aba admin "Lifecycle v1", com comparação por família.
Entregue: métricas de Retenção/Churn no registry (MTR-023 taxa de retenção 12m, MTR-024 clientes perdidos 12m) — coorte 12m × 12m sobre o universo NF, reconciliadas como SEM LEGADO (motor legado usa remessa).
Pendente: assinatura do CFO no ADR-010, reconciliação por cliente do lifecycle (doc 10 passo 2) e aprovação das divergências com o negócio (passo 3).

Metric Layer no backend, métrica por métrica, com reconciliação obrigatória:
```
legacy_metric · canonical_metric · absolute_difference · percentage_difference · reason · approved
```
Ordem sugerida: Revenue → Cadastros/Novos clientes → Ticket médio → Concentração → Recebíveis/DSO → Retenção/Churn.
`DatasetRelease` com publicação atômica substitui os três snapshots.

## Phase 5 — Customer Journey
Ligar comercial (CRM/orçamentos) ao operacional e financeiro sobre o modelo de eventos.

## Phase 6 — Executive Cockpit
Nova navegação por decisão, somente sobre métricas oficiais; ferramentas técnicas movidas para a área Admin.

## Phase 7 — AI Advisor
EvidencePackage + Benchmark Registry + categorias FACT/INFERENCE/BENCHMARK/HYPOTHESIS/RECOMMENDATION + ExecutiveFinding.

## Phase 8 — Decision Memory
Decision, DecisionAction, DecisionOutcome e aprendizado.

## Phase 9 — Internal Data Platform
Contratos estáveis (`brain.customers`, `brain.rentals`, `brain.assets`, `brain.invoices`, `brain.metrics`) para outras aplicações do ecossistema.

## Regras de migração
1. Toda métrica migrada roda em paralelo antes de substituir.
2. Divergência acima do limite exige explicação e aprovação, não ajuste silencioso.
3. Regra de negócio só é removida com origem documentada e substituto ativo.
4. Telas legadas permanecem acessíveis (somente leitura) até a substituição ser aprovada.