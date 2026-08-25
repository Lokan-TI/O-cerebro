# 12 — METRIC REGISTRY (v0.1)

Versão 0.1 · 2026-08-13 · Status: DRAFT
Regra: nenhum dashboard cria KPI. Toda métrica exibida deve constar aqui com versão, grain, data de referência e requisitos de qualidade. Métrica sem `source_of_truth` TRUSTED é exibida com selo **NÃO OFICIAL**.

## Campos obrigatórios
`metric_id · business_name · description · business_owner · technical_owner · version · formula · numerator · denominator · grain · dimensions[] · time_dimension · aggregation_method · unit · currency · source_of_truth · dependencies[] · valid_from · valid_until · quality_requirements · benchmark_eligibility`

---

## MTR-001 · Revenue (Receita)
- business_name: Receita
- description: valor bruto faturado por notas fiscais válidas (não canceladas) no período.
- business_owner: **A DEFINIR (CFO)** · technical_owner: Data Platform
- version: 0.1 · valid_from: pendente
- formula: `Σ Invoice.gross_amount` onde `Invoice.status ≠ CANCELLED`
- grain: invoice · time_dimension: `invoice_date` · unit: BRL
- source_of_truth: `Invoice` (canônico) — **hoje indisponível**; substituto atual `SourceMetric.erp_invoice_synthetic_amount` (`nf.vl_faturamento`), TRUSTED = false
- quality_requirements: completeness ≥ 99%, validade de cancelamento ≥ 99,5%, mapping de cliente ≥ 98%, freshness ≤ 24h, reconciliação com relatório "Total" do ERP ≤ 0,5%
- perguntas abertas que bloqueiam TRUSTED: inclui impostos? frete? serviços extras? devolução altera o campo? estorno é negativo?
- status: **BLOQUEADA** para uso oficial

### Reconciliação executada (2026-08-13 · `reconcileRevenue`)
Universo: NF de saída, não cancelada e não anulada (`fl_ent_sai='S'`, `fl_can_nf<>'S'`, `dt_cancelamento IS NULL`, `dt_anul_nf IS NULL`), data de referência `dt_emi_nf`, ano 2025 · 19.367 NFs.

| Candidato | Total 2025 | Δ vs. referência |
|---|---|---|
| A · `Σ vl_faturamento` (referência atual) | R$ 50.036.361 | — |
| B · `Σ vl_total_nf` | R$ 767.234.577 | +1.433% |
| C · `Σ (vl_merc_nf + vl_serv_nf)` | R$ 767.255.546 | +1.433% |
| D · `Σ vl_liquido_nf` | R$ 767.234.577 | +1.433% |

**Fatos observados:** B, C e D convergem entre si e divergem de A em ~15×, indício forte de que o valor total da NF inclui documentos sem receita (remessa/retorno de equipamento de locação), enquanto `vl_faturamento` já é o campo restrito ao faturamento. Fora do universo há 1.945 NFs canceladas/anuladas (R$ 9,4 M em `vl_faturamento`) e, dentro do universo, 1.751 NFs válidas com `vl_faturamento` = 0.

**Decisão pendente (bloqueia TRUSTED):** confirmar com o CFO se a Receita oficial é o candidato A e qual o tratamento das 1.751 NFs de valor zerado. Registrar em ADR antes de promover a métrica.

## MTR-002 · Net Revenue
Receita menos devoluções, cancelamentos e descontos. Depende de eventos de devolução ainda não modelados. status: **NÃO IMPLEMENTÁVEL**.

## MTR-003 · Revenue Growth (MoM / YoY / YTD)
- formula: `(Revenue[P] / Revenue[P-1]) - 1`, com `comparison_mode` explícito do AnalysisContext
- regra: MoM ≠ YoY ≠ YTD vs Prior YTD; o rótulo exibido deve nomear a comparação exata. status: depende de MTR-001.

## MTR-004 · New Customer Revenue / MTR-005 · Existing Customer Revenue
- definição de "novo": primeira NF dentro do período analisado (coorte por primeira atividade).
- conflito atual: `clientConversion.ts` usa data de cadastro; `refreshErpData` usa primeira NF → **duas definições**. Decisão v1: primeira NF; coorte de cadastro passa a chamar-se "Cadastros do período" (métrica distinta, MTR-016).

## MTR-006 · Average Ticket
- formula: `Revenue / count(distinct customers com Revenue > 0)`
- conflito atual: uma tela divide pela base total de clientes. Aquela variante torna-se MTR-006b `Revenue per Registered Customer`.

## MTR-007 · Top Customer Concentration
- formula: `Σ Revenue dos top N / Revenue total`, N declarado (padrão 10). dimensions: branch, período.

## MTR-008 · Customer Retention / MTR-009 · Revenue Retention
Base = clientes ACTIVE no período anterior; retidos = com atividade no período atual. Exige lifecycle v1 aprovado.

## MTR-010 · Churn Rate / MTR-011 · Revenue Churn
- formula: `churned no período / base elegível no início do período`, `as_of_date` obrigatório, `lifecycle_version` declarada.
- candidato específico de locação v2 (doc 26): hard churn somente quando **não há contrato vigente** e **não há atividade válida de locação por N meses** (`N=13` padrão). Atividade = remessa realizada, faturamento da ficha, última geração ou movimento operacional ligado ao contrato. Ciclo de faturamento e horizonte do contrato são dimensões separadas.
- status: **BLOQUEADA / EM HOMOLOGAÇÃO** até Comercial/Growth aprovar a v2 e a reconciliação mostrar os falsos churn removidos.

## MTR-012 · Reactivation Rate · MTR-013 · Repeat Rental Rate
Derivadas de eventos de lifecycle.

## MTR-014 · Quote Conversion · MTR-015 · Lead Conversion · Sales Cycle
Depende de `mkt_orcamento`/CRM (fonte indisponível). status: **NÃO IMPLEMENTÁVEL**.

## MTR-016 · Cadastros do período
`count(Party criado no período com PartyRole=Customer)` — métrica de cadastro, não de receita.

## MTR-020 · Accounts Receivable (CAR em aberto)
`Σ Receivable.open_amount` em `as_of_date`. Métrica de estoque (point-in-time), nunca somada ao longo de períodos.

## MTR-021 · Overdue Receivables · MTR-022 · DSO · MTR-023 · Default Rate
DSO = `(AR médio / Revenue do período) × dias do período` — exige MTR-001.

## MTR-030 · Cash Flow View (CAR − CAP)
- **Renomeação obrigatória:** o indicador hoje apresentado como margem/resultado é uma **visão de caixa** entre recebíveis e pagáveis.
- proibido rotular como Operating Margin, Gross Margin ou EBITDA.
- Gross Margin (MTR-031), Contribution Margin (MTR-032), Operating Margin (MTR-033) e Markup (MTR-034) permanecem **NÃO IMPLEMENTÁVEIS** enquanto não houver custo por evento (`CostEvent`) e custo de manutenção.

## MTR-040..049 · Frota
Asset Utilization (física e financeira), Idle Days, Yield per Day, Revenue per Asset, Availability, Downtime, Maintenance Cost per Asset — dependem de `Asset`/`MaintenanceEvent`. status: **NÃO IMPLEMENTÁVEIS**.

## MTR-050 · Rental Duration · MTR-051 · Extension Rate · MTR-052 · Cancellation Rate
Dependem da definição do evento de ativação do contrato (ver doc 03).

---

## Resumo de prontidão
| Faixa | Situação |
|---|---|
| Implementáveis após reconciliação de receita | MTR-001, 003, 004, 005, 006, 007, 016, 020–023, 030 |
| Bloqueadas por lifecycle | MTR-008 a MTR-013 |
| Não implementáveis (fonte ausente) | MTR-002, 014, 015, 031–034, 040–052 |

Nenhuma métrica desta lista está TRUSTED hoje. Todas as telas atuais que as exibem devem receber selo de confiança até a conclusão da Phase 4.

### Benchmark técnico separado · SISLOC-RECEITA-GRUPO
`SISLOC-RECEITA-GRUPO` não substitui MTR-001 e não deve ser rotulado genericamente como Receita. Ele reproduz o relatório `TGersReceitaGrupoList` capturado em 25/08/2026, com `tipo_periodo=1`, data `v_nf_emissao.dt_emissao`, rateio por `nffatur.vl_nffatur` e cinco blocos: locação, venda, manutenção/OM, serviços e indenizações. Implementação: `receitaSislocRateio`. Status: **RECONCILIATION_READY / NÃO TRUSTED** até execução ERP × Cérebro dentro da tolerância definida.

---

## Metric Layer executável (Phase 4 · registry v0.1)
Registry em código: `base44/shared/metricRegistry.ts`. Porta única de cálculo: função `computeMetric` (AnalysisContext obrigatório: `period_start`, `period_end`, `source_id`, `cd_empresa`, `comparison_mode`). Toda resposta devolve valor, selo de confiança, perguntas bloqueadoras e a **linhagem** (SQL executada). Aba admin "Camada Semântica" consome apenas essa função.

Universo compartilhado (idêntico ao da reconciliação): `fl_ent_sai='S' AND ISNULL(fl_can_nf,'N')<>'S' AND dt_cancelamento IS NULL AND dt_anul_nf IS NULL`, data de referência `dt_emi_nf`, cliente da nota = `nf.cd_pessoa`.

| Métrica | Implementada | Valor 2025 (Matriz, todas as empresas) | vs. 2024 |
|---|---|---|---|
| MTR-001 Receita | sim | R$ 50.036.361 | +24,6% |
| MTR-006 Ticket médio por cliente faturado | sim | R$ 21.401 | +14,6% |
| MTR-007 Concentração top 10 | sim | 21,0% | — |
| MTR-017 Clientes faturados no período | sim | — (calculado on demand) | — |

**MTR-017 · Clientes faturados no período** (novo): `count(distinct nf.cd_pessoa)` com Receita > 0. Métrica de atividade, distinta de MTR-016 (Cadastros). Contagem por cliente do ERP, não por Party canônico.

### Reconciliação legado × canônico (2025, Matriz consolidado)
Função `reconcileMetrics` · entidade `MetricReconciliation` (uma linha por métrica/janela, com linhagem SQL, status e aceite). Tolerância: match ≤ 0,5% · atenção ≤ 2% · divergente > 2%.

| Métrica | Legado (snapshot) | Canônico | Δ | Status |
|---|---|---|---|---|
| MTR-001 Receita | R$ 50.036.361 | R$ 50.036.361 | 0% | ADERENTE |
| MTR-006 Ticket médio | R$ 20.927 | R$ 21.401 | +2,27% | DIVERGENTE — justificado |
| MTR-017 Clientes faturados | 2.391 | ~2.338 | −2,2% | DIVERGENTE — justificado |
| MTR-007 Concentração top 10 | — | 21,0% | — | SEM LEGADO |
| MTR-018 NFs faturadas | — | executável | — | SEM LEGADO |
| MTR-019 Novos clientes faturados | annual_evolution.novos_clientes | executável | — | comparado a cada execução |

| MTR-020 Recebíveis em aberto | — | executável | — | SEM LEGADO (janela do analytics difere) |
| MTR-021 Recebíveis vencidos | — | executável | — | SEM LEGADO (depende da data corrente) |
| MTR-022 DSO | — | executável | — | SEM LEGADO |
| MTR-023 Taxa de retenção 12m | — | executável | — | SEM LEGADO (lifecycle v1 · NF; legado usa remessa) |
| MTR-024 Clientes perdidos 12m | — | executável | — | SEM LEGADO (idem) |

MTR-018 e MTR-019 entraram no registry executável (v0.1). MTR-019 define "novo" pela **primeira NF faturada de todos os tempos**, enquanto o legado usa data de cadastro (doc 10) — divergência estrutural esperada.

**Causa das divergências (mesma raiz):** o snapshot legado conta clientes com qualquer NF válida no período; o canônico exige Receita > 0. Divergência esperada, registrada com justificativa e aceite no próprio registro de reconciliação — não é erro de cálculo.

Todas as quatro seguem **NÃO OFICIAL**: dependem da decisão do CFO sobre o candidato de receita e do tratamento das NFs de valor zerado.