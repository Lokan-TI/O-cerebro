# 13 — ANALYSIS CONTEXT (contrato único de análise)

Versão 1.0-draft · 2026-08-13

Todo cálculo, tela, exportação, API e agente de IA deve receber **o mesmo** objeto. Não existe cálculo sem AnalysisContext.

## Contrato
```json
{
  "organization_id": "ORG-001",
  "source_scope": ["SRC-MATRIZ"],
  "branch_ids": [],
  "period_start": "2026-01-01",
  "period_end": "2026-08-13",
  "as_of_date": "2026-08-13",
  "comparison_mode": "YoY",
  "comparison_period_start": "2025-01-01",
  "comparison_period_end": "2025-08-13",
  "customer_segments": [],
  "product_segments": [],
  "seller_ids": [],
  "channel_ids": [],
  "currency": "BRL",
  "timezone": "America/Sao_Paulo",
  "metric_versions": { "MTR-001": "0.1", "lifecycle": "1.0" },
  "dataset_release_id": "REL-2026-08-13-001"
}
```

## Invariantes
1. `branch_ids` vazio = todas as filiais do `source_scope` (nunca "indefinido").
2. `as_of_date` ≠ `period_end` é legítimo e deve ser exibido quando divergirem.
3. `comparison_mode` ∈ {NONE, PreviousPeriod, MoM, YoY, YTDvsPriorYTD, Rolling12M, BudgetVsActual, ForecastVsActual}; o rótulo da tela deve nomear exatamente o modo.
4. Nenhum componente pode manter filtro local (viola audit P1-06 — caso `TabComparativo`).
5. Mudança de qualquer campo invalida todos os números da tela simultaneamente; é proibido exibir KPI de contexto antigo ao lado de KPI novo.
6. Toda resposta de métrica retorna o contexto que a gerou (`echo` do contrato) + `quality_status`.

## Estado atual vs alvo
| Hoje | Alvo |
|---|---|
| `GlobalFilterContext` + `EmpresaFilterContext` + estados locais | um `AnalysisContextProvider` único |
| período aplicado só após re-agregação manual (`PeriodMismatchNotice`) | release pré-calculada por contexto; UI nunca dispara ETL |
| ausência de `as_of_date` | obrigatório e persistido em toda release |
| ausência de `metric_versions` | obrigatório em toda resposta |

## Transporte
- Front → backend: corpo da chamada da métrica (nunca reconstruído no backend por conveniência).
- Backend → LLM: o mesmo contexto dentro do `EvidencePackage`.
- Exportações: o contexto vai no cabeçalho do arquivo exportado (rastreabilidade).