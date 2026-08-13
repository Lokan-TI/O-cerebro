# 04 — TARGET ARCHITECTURE

Versão 1.0-draft · 2026-08-13

## Fluxo
```
SOURCES → INGESTION → RAW → DATA QUALITY → IDENTITY RESOLUTION → CANONICAL
→ SEMANTIC/METRIC → ANALYSIS CONTEXT → ANALYTICS → BENCHMARK → AI → DECISION SUPPORT → DECISION MEMORY
```

## Planos e responsabilidades
### Source & Integration Plane
`ErpDataSource` (sem senha, com `secret_reference`), connectors (SQL Server, MySQL, PostgreSQL, BigQuery, REST/SaaS), jobs de extração com watermark, CDC quando disponível, webhooks.
Isolamento **por fonte**: pool, fila, rate limit e worker próprios (remove o mutex global — audit P1-10). Um connector nunca define KPI.

### Raw Data Plane
Novo. Cada registro bruto guarda: `source_system_id, source_database, source_schema, source_table, source_record_id, source_updated_at, extracted_at, ingestion_run_id, schema_version, payload_hash`.
Sem transformação de negócio. Base de reprocessamento e de prova.

### Canonical Data Plane
Entidades do doc 03, com IDs canônicos e crosswalk de identidade. Nenhuma tela referencia `nf`, `pessoa`, `fich_loc`, `car`, `cap`.

### Semantic & Metric Plane
Metric Registry executável: cada métrica é uma função versionada no backend que recebe AnalysisContext e devolve valor + lineage + quality. Único lugar onde existe regra crítica.

### Intelligence Plane
Anomalias, diagnósticos, previsão, benchmark, hipóteses, EvidencePackage, ExecutiveFinding.

### Experience Plane
Somente apresentação. Organizada por decisão (Executive Cockpit, Customer Journey, Revenue & Growth, Fleet & Operations, Finance & Risk, The Brain, Data Governance, Integrations) e uma área Admin/Engineering separada para SQL, Schema Explorer, dicionário, sync runs e logs (audit P0-02).

### Governance & Security Plane
RBAC + ABAC, RLS por organização/filial, field-level security para PII, secret manager, audit trail (incluindo exportações), lineage, quality, observabilidade.

## Publicação de dados: DatasetRelease
```
release_id · created_at · analysis_context · source_versions[] · semantic_model_version
· metric_registry_version · lifecycle_version · quality_status · publication_status · release_pointer
```
Regras: uma release agrupa **todas** as partes (hoje três snapshots independentes — audit P2-14); publicação é atômica via ponteiro único; release só publica se os quality gates obrigatórios passarem.

## Componentes-alvo por artefato atual
| Atual | Alvo |
|---|---|
| `refreshErpData` / `refreshClienteDim` / `refreshClientConversion` | jobs de ingestão + builders canônicos + release única |
| `ErpSnapshot` / `ClienteDimSnapshot` / `ClientConversionSnapshot` | `DatasetRelease` + marts derivados |
| `clienteDim.ts` / `churnUniverse.ts` / `classifyClientStatus` | serviço único de Customer Lifecycle |
| `decisionKpis.js` / `analyticsView.js` / cálculos em abas | Metric Layer no backend |
| `rentalIndustry.js` / `heroPhrases.js` | Benchmark Registry + conteúdo governado |
| `sqlServerQuery` + `QueryRunner` | Admin plane com allowlist, limites e auditoria |
| `sislocSchema.ts` / `validateSislocSchema` / `listDicionarioDados` | Source Discovery Engine + `SourceSemanticContract` + drift monitor |
| páginas `Dashboard`, `GoogleDashboard`, `FunilConversao` | retiradas (fonte de requisito) |

## Coexistência
Legado e nova arquitetura convivem durante toda a migração. Nenhuma métrica é substituída sem teste de reconciliação aprovado (doc 21).