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
Pendente: reconciliação legado × canônico persistida (`MetricReconciliation`), demais métricas da ordem sugerida e `DatasetRelease` atômico.

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