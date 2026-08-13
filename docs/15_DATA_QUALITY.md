# 15 — DATA QUALITY FRAMEWORK

Versão 1.0-draft · 2026-08-13

## Entidades
`DataQualityRule` (id, dimensão, escopo, expressão, severidade, owner, versão) · `DataQualityRun` (release_id, executado_em, duração, resultados) · `DataQualityIssue` (rule_id, registros afetados, amostra, status, responsável).

## Dimensões cobertas
completeness · uniqueness · validity · consistency · freshness · referential_integrity · distribution · schema_drift · volume_anomaly · financial_reconciliation · cross_source_reconciliation · duplicate_detection.

## Regras iniciais propostas (fonte Lokan)
| rule_id | Dimensão | Regra | Severidade |
|---|---|---|---|
| DQ-001 | referential_integrity | toda `nf.cd_pessoa` existe em `pessoa` | P0 |
| DQ-002 | validity | NF cancelada identificável de forma inequívoca | P0 |
| DQ-003 | financial_reconciliation | Σ receita canônica vs relatório "Total" do ERP ≤ 0,5% | P0 |
| DQ-004 | freshness | `max(invoice_date)` ≤ 24h da release | P1 |
| DQ-005 | completeness | documento (CPF/CNPJ) válido em ≥ 95% dos clientes com faturamento | P1 |
| DQ-006 | duplicate_detection | duplicidade de documento na base de Party ≤ 1% | P1 |
| DQ-007 | validity | data futura em `invoice_date` = 0 | P1 |
| DQ-008 | consistency | Σ CAR por cliente compatível com NFs do período | P1 |
| DQ-009 | volume_anomaly | variação de volume diário fora de ±3σ gera alerta | P2 |
| DQ-010 | schema_drift | nenhuma mudança não revisada no contrato semântico | P2 |

## Quality Gates
Uma release só é publicada se todas as regras P0 do domínio passarem. Regra P1 falhando publica com **DATA QUALITY WARNING** e reduz o `confidence` de qualquer análise/IA que dependa daquele domínio.

Exemplo (Revenue): `invoice_data_completeness ≥ 99%`, `cancel_status_validity ≥ 99,5%`, `customer_mapping ≥ 98%`, `freshness ≤ 24h`.

## Exibição ao usuário
Todo KPI mostra selo: **OFICIAL** · **AVISO DE QUALIDADE** · **NÃO OFICIAL**. Clicando, o executivo vê a explicação simples; o administrador vê o lineage técnico completo (doc 16).