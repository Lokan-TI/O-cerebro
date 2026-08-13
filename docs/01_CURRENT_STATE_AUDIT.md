# 01 — CURRENT STATE AUDIT

Versão 1.0 · 2026-08-13 · Status: DRAFT para validação de negócio
Escopo: aplicação "O Cérebro" (Base44) — páginas, componentes, contexts, funções backend, entidades, snapshots e SQL existentes.
Método: inventário de artefatos + leitura de responsabilidades + histórico de decisões e becos sem saída registrados no projeto.

---

## 1. Inventário macro

| Plano arquitetural | Artefatos atuais | Situação |
|---|---|---|
| Source & Integration | `ErpDataSource`, `IntegrationConnection`, `testErpConnection`, `listErpSources`, `base44/shared/erpConnection.ts`, wrapper DW_API, connector BigQuery (read-only) | Existe, sem isolamento por fonte |
| Raw Data | **inexistente** | Não há camada bruta preservada; toda leitura é query ao vivo no ERP |
| Canonical | **inexistente** | Dashboards consomem nomenclatura física do Sisloc (`nf`, `pessoa`, `fich_loc`, `car`, `cap`) |
| Semantic / Metric | disperso em `base44/shared/*.ts`, `src/lib/decisionKpis.js`, `src/lib/analyticsView.js` e dentro de componentes de aba | Regra crítica dentro do front-end |
| Snapshots | `ErpSnapshot`, `ClienteDimSnapshot`, `ClientConversionSnapshot`, `ErpSyncRun` | Três snapshots independentes, sem release coordenado |
| Intelligence | `src/components/brain/*`, `buildBrainContext.js`, `src/lib/rentalIndustry.js`, `heroPhrases.js` | Benchmarks e frases hardcoded, sem evidência |
| Experience | `ErpCrmDashboard` (14 abas), `BrainHome`, `PainelDecisao`, `GrowthMarketing`, `ConversaoNovosClientes`, `GerenciarFontes`, `Integracoes`, `Dashboard`/`GoogleDashboard`/`FunilConversao` legados | Navegação orientada a schema e a ferramentas técnicas |
| Governance & Security | RLS por entidade, secrets de ambiente, `password` em `ErpDataSource`, `sqlServerQuery` exposto na UI | Lacunas P0 |

---

## 2. Findings

### P0-01 — Credencial de banco armazenada como campo de entidade
- issue_id: P0-01 · severity: P0 · domain: Security
- artifact: `base44/entities/ErpDataSource.jsonc` (`password`, `username`), `base44/shared/erpConnection.ts`
- description: a senha do SQL Server é persistida em campo de entidade (`credential_reference: "entity"`), não em secret manager.
- business_impact: vazamento de credencial de produção do ERP.
- technical_impact: credencial trafega pelo modelo de dados, aparece em backups, exports e logs de entidade.
- evidence: schema da entidade contém `password` com nota "processado exclusivamente pelo back-end"; RLS restringe leitura a admin, mas admin de app ≠ custodiante de credencial.
- root_cause: ausência de `secret_reference` no modelo de fontes.
- recommended_solution: substituir por `secret_reference` (nome do secret) + resolução exclusiva no backend; migrar as fontes existentes; remover o campo do schema.
- dependencies: `erpConnection.ts`, `GerenciarFontes`, `AdicionarFonteModal`, `VerConfigModal`.
- migration_risk: médio — exige recadastro de credencial por fonte.
- decision: **REFACTOR**

### P0-02 — Execução de SQL arbitrário exposta na experiência analítica
- issue_id: P0-02 · severity: P0 · domain: Security
- artifact: `base44/functions/sqlServerQuery/entry.ts`, `src/components/erp/QueryRunner.jsx`, aba "Query SQL" no `ErpCrmDashboard`
- description: aba de query livre convive com o cockpit; validação baseada em "começa com SELECT".
- business_impact: risco de exfiltração e de carga destrutiva sobre o ERP de produção.
- technical_impact: prefix-check não protege contra subqueries, `xp_`/`OPENROWSET`, cross-database, DoS por full scan.
- root_cause: ferramenta técnica no plano de experiência executiva.
- recommended_solution: mover para área administrativa com papel próprio (`role: data_engineer`), allowlist de objetos, limite de linhas/tempo, log de auditoria por execução.
- migration_risk: baixo.
- decision: **MIGRATE**

### P0-03 — Publicação de snapshot não atômica
- issue_id: P0-03 · severity: P0 · domain: Data integrity
- artifact: `refreshErpData`, `refreshClienteDim`, `refreshClientConversion` (padrão "zera `is_current`, grava novo")
- description: duas operações independentes definem qual versão está publicada.
- business_impact: janela em que o executivo vê zero snapshots ou dois "atuais".
- recommended_solution: `DatasetRelease` com ponteiro único (alias) atualizado por operação única; leitura sempre pelo ponteiro.
- decision: **REFACTOR**

### P0-04 — Definições concorrentes de churn / cliente ativo
- issue_id: P0-04 · severity: P0 · domain: Semantics
- artifact: `base44/shared/clienteDim.ts` (status por recência), `base44/shared/churnUniverse.ts` + `analyzeClientChurn`, `classifyClientStatus`, `TabChurn`, `Cliente360Kpis`
- description: há pelo menos três regras de "ativo / em risco / churn" com janelas próprias e universos diferentes.
- evidence: KPI "EM CHURN (>1 ano) = 0" na aba Cliente 360 convive com a aba Retenção & Churn apurando churn — mesmo nome, universos distintos.
- business_impact: decisão de retenção sobre número não reprodutível.
- recommended_solution: máquina de estados única e versionada (doc 10), com `as_of_date` obrigatório; abas passam a ler o estado, não a recalculá-lo.
- decision: **REFACTOR**

### P0-05 — Classificação temporal dependente da data atual
- issue_id: P0-05 · severity: P0 · domain: Semantics
- artifact: `clienteDim.ts`, `churnUniverse.ts`, `decisionKpis.js`
- description: recência/status calculados contra "agora" da execução, sem `as_of_date` persistido.
- business_impact: o mesmo snapshot reexecutado produz status diferente; histórico não é auditável.
- recommended_solution: `as_of_date` no `AnalysisContext` e gravado em todo snapshot; proibir `new Date()` como regra.
- decision: **REFACTOR**

### P1-06 — Filtro global não é universal
- issue_id: P1-06 · severity: P1 · domain: Semantics / Product
- artifact: `GlobalFilterContext`, `EmpresaFilterContext`, `TabComparativo` (filtro local de empresa), `PeriodMismatchNotice`
- description: parte das abas responde ao filtro global; `TabComparativo` mantém filtro próprio; períodos só passam a valer após re-agregação manual do snapshot.
- business_impact: tela com filtro aplicado exibindo KPI de outro universo.
- recommended_solution: `AnalysisContext` único (doc 13) como única entrada de qualquer cálculo; remover estados locais de filtro.
- decision: **REFACTOR**

### P1-07 — Benchmarks e conteúdo estratégico hardcoded
- issue_id: P1-07 · severity: P1 · domain: Governance / AI
- artifact: `src/lib/rentalIndustry.js`, `src/lib/heroPhrases.js`, `buildBrainContext.js`, cartões de "dicas"
- description: referências de mercado (Mills, Loxam, Casa do Construtor etc.) e faixas de benchmark vivem em código, sem fonte, data, metodologia ou aprovação.
- business_impact: recomendação executiva comparada a número sem proveniência.
- recommended_solution: `BenchmarkDefinition`/`BenchmarkValue`/`BenchmarkSource` (doc 17); na ausência de benchmark confiável, responder explicitamente "indisponível".
- decision: **MIGRATE**

### P1-08 — Regra de negócio dentro de componentes de tela
- issue_id: P1-08 · severity: P1 · domain: Architecture
- artifact: `TabClientesPessoa`, `TabFinanceiro`, `TabExecutiva`, `TabLocacoes`, `TabOperacional`, `Cliente360Kpis`, `decisionKpis.js`, `empresaComparison.js`, `scopeSnapshot.js`
- description: concentração, ticket médio, margem, recorrência e agregações por empresa são calculados em JSX/utils de front.
- recommended_solution: Metric Layer no backend servindo métricas já calculadas e versionadas; componentes só formatam.
- decision: **REFACTOR**

### P1-09 — Semântica financeira não fundamentada
- issue_id: P1-09 · severity: P1 · domain: Finance semantics
- artifact: abas Financeiro / Visão Executiva / Painel de Decisão (uso de CAR − CAP e derivados)
- description: diferenças entre contas a receber e a pagar são apresentadas com vocabulário de margem/resultado.
- business_impact: leitura contábil incorreta em decisão de preço e investimento.
- recommended_solution: separar Cash Flow, Gross Margin, Contribution Margin, Operating Margin e Markup com definição aprovada (doc 12/27).
- decision: **REFACTOR**

### P1-10 — Mutex global de queries serializa todas as fontes
- issue_id: P1-10 · severity: P1 · domain: Reliability
- artifact: `base44/shared/erpConnection.ts` (mutex global)
- description: uma única fila global de queries; uma fonte lenta bloqueia todas.
- evidence: histórico de timeouts de gateway e instabilidade ao alternar fontes.
- recommended_solution: pool + fila + rate limit por `source_id`; ingestão fora do caminho da navegação.
- decision: **REFACTOR**

### P1-11 — ETL disparado por navegação do usuário
- issue_id: P1-11 · severity: P1 · domain: Reliability / Product
- artifact: `RefreshHeader`, `GlobalFilterBar` (re-agregação ao aplicar filtro), `refreshErpData`, `refreshClienteDim`
- description: agregações de 20–40s executadas a partir de clique de executivo; exportações paginam ~20k registros no browser.
- recommended_solution: jobs agendados com watermark/incremental + releases publicadas; UI apenas lê release.
- decision: **REFACTOR**

### P1-12 — Autoria de vendedor e atribuição de receita sem contrato
- issue_id: P1-12 · severity: P1 · domain: Semantics
- artifact: `refreshErpData` (top_vendors), `financas_car_comissao`, histórico de uso de `nf.cd_pessoa_fun`
- description: a regra de atribuição de vendedor foi corrigida empiricamente, sem contrato semântico versionado.
- recommended_solution: registrar em `SourceSemanticContract` + teste de reconciliação contra relatório do ERP.
- decision: **REFACTOR**

### P1-13 — `vl_faturamento` alimentando métrica oficial de Receita
- issue_id: P1-13 · severity: P1 · domain: Data trust
- artifact: `refreshErpData`, `analyticsBlock.ts`, KPI "Faturamento total"
- description: campo sintético do ERP, divergente dos relatórios internos (Total e Receita por Grupo), já reconhecido no histórico do projeto.
- status de maturidade: DISCOVERED ✅ · UNDERSTOOD ✅ · TRUSTED ❌
- recommended_solution: manter como `SourceMetric.erp_invoice_synthetic_amount` até reconciliação; Revenue oficial só após teste de conciliação aprovado.
- decision: **REFACTOR**

### P2-14 — Três snapshots sem coordenação de versão
- artifact: `ErpSnapshot`, `ClienteDimSnapshot`, `ClientConversionSnapshot` · domain: Data architecture
- description: janelas, horários e regras diferentes; a tela combina blocos de releases distintas (ex.: snapshot de dados até 2026-08-13 com dimensão de cliente até 2026-08-07).
- recommended_solution: `DatasetRelease` agrupando todas as partes. · decision: **REFACTOR**

### P2-15 — Semântica de execução incorreta
- artifact: `ErpSyncRun`, `ErpSnapshot.query_count`, cartão "Registros: 14.845"
- description: `query_count` e contagem de registros são exibidos como volume extraído.
- recommended_solution: `queries_executed`, `records_read`, `records_written`, `records_rejected`, `bytes_processed`. · decision: **REFACTOR**

### P2-16 — Páginas e dados legados de protótipo
- artifact: `src/pages/Dashboard.jsx`, `GoogleDashboard.jsx`, `FunilConversao.jsx`, `src/components/dashboard/leadsData.jsx`, `src/components/google/googleData.jsx`, entidade `Lead`
- description: dados de demonstração embutidos no front, convivendo com dados reais.
- recommended_solution: retirar da navegação principal; preservar como referência de requisito. · decision: **RETIRE**

### P2-17 — Descoberta de schema sem catálogo persistido
- artifact: `validateSislocSchema`, `sislocSchema.ts`, `SchemaExplorer`, `listDicionarioDados`
- description: descoberta é feita ao vivo e descartada; sem `SourceSemanticContract` nem detecção de drift.
- recommended_solution: persistir inventário + dicionário + profiling por fonte e versionar. · decision: **MIGRATE**

### P2-18 — PII sem classificação nem autorização de campo
- artifact: `listClientesCadastro`, `clientesCadastroExport.js`, `listFornecedores`, `Cliente360Table`
- description: CPF, RG, filiação, telefone, endereço e observações são exportados sem classificação nem controle de campo por papel.
- recommended_solution: classificação PII por coluna + field-level security + auditoria de exportação. · decision: **REFACTOR**

### P3-19 — Duplicação de exportadores CSV
- artifact: `clientesCadastroExport.js`, `fornecedoresExport.js`, `equipamentosExport.js`, CSV embutido em `TabClientesCar`
- recommended_solution: um serviço de exportação com formatação e políticas de PII centralizadas. · decision: **REFACTOR**

### P3-20 — Cache de layout/filtros em `localStorage` sem versionamento
- artifact: `GlobalFilterContext`, `ErpSourceContext`, preferências de layout
- recommended_solution: chave versionada + invalidação por versão de contexto. · decision: **KEEP com ajuste**

---

## 3. Métricas com mais de uma definição hoje

| Métrica exibida | Definições concorrentes | Onde |
|---|---|---|
| Cliente ativo | recência 90d; presença de CAR aberto; faturamento no período | `clienteDim.ts`, `TabClientesCar`, `TabClientesPessoa` |
| Churn | inatividade >1 ano; universo de churn próprio; classificação sob demanda | `clienteDim.ts`, `churnUniverse.ts`, `classifyClientStatus` |
| Faturamento | `nf.vl_faturamento`; agregação de CAR; bloco `analytics` | `refreshErpData`, `analyticsBlock.ts`, `TabFinanceiro` |
| Novo cliente | primeira NF; data de cadastro (coorte de conversão) | `refreshErpData`, `clientConversion.ts` |
| Ticket médio | receita/clientes com faturamento; receita/total de clientes | `Cliente360Kpis`, `TabClientesPessoa` |

Cada linha desta tabela é um risco de decisão divergente e será resolvida no `12_METRIC_REGISTRY`.

---

## 4. Conclusão

A aplicação é um **protótipo funcional de alto valor como fonte de requisitos**, e não uma plataforma de dados confiável: não há camada bruta, não há modelo canônico, a semântica vive no front-end e a publicação de dados não é atômica.

Recomendação: **congelar a criação de novos dashboards** (Phase 0), corrigir P0-01 a P0-05 e seguir o roteiro do `21_MIGRATION_PLAN`.