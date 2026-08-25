# 13 — ANALYSIS CONTEXT (contrato único de análise)

Versão 1.1 · 2026-08-25

Todo cálculo, tela, exportação, API e agente de IA deve receber **o mesmo** objeto. Não existe cálculo sem AnalysisContext.

## Contrato
```json
{
  "organization_id": "ORG-001",
  "source_scope": ["SRC-MATRIZ"],
  "branch_ids": [],
  "period_start": "2026-01-01",
  "period_end_inclusive": "2026-08-25",
  "period_end_exclusive": "2026-08-26",
  "as_of_date": "2026-08-25",
  "comparison_mode": "YoY",
  "comparison_period_start": "2025-01-01",
  "comparison_period_end_inclusive": "2025-08-25",
  "comparison_period_end_exclusive": "2025-08-26",
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
2. Datas exibidas/selecionadas pelo usuário são inclusivas. SQL analítico usa sempre intervalo meio-aberto `[period_start, period_end_exclusive)`.
3. Para 01/01/2026 a 25/08/2026, o contrato obrigatório é `period_start=2026-01-01`, `period_end_inclusive=2026-08-25`, `period_end_exclusive=2026-08-26`.
4. É proibido cada função aplicar seu próprio `DATEADD(day,1,...)` se já recebeu `period_end_exclusive`.
5. O campo legado `period_end`, enquanto existir em APIs antigas/Metric Registry, significa **fim exclusivo**. Novas APIs devem preferir o nome explícito `period_end_exclusive`.
6. `as_of_date` ≠ `period_end_inclusive` é legítimo e deve ser exibido quando divergirem.
7. `comparison_mode` ∈ {NONE, PreviousPeriod, MoM, YoY, YTDvsPriorYTD, Rolling12M, BudgetVsActual, ForecastVsActual}; o rótulo da tela deve nomear exatamente o modo.
8. Nenhum componente pode manter filtro temporal local sem declarar explicitamente que é uma análise independente do contexto global.
9. Mudança de qualquer campo invalida todos os números da tela simultaneamente; é proibido exibir KPI de contexto antigo ao lado de KPI novo.
10. Toda resposta de métrica retorna o contexto que a gerou (`echo` do contrato) + `quality_status`.

## Estado atual vs alvo
| Hoje | Alvo |
|---|---|
| `GlobalFilterContext` + `EmpresaFilterContext` + estados locais | um `AnalysisContextProvider` único |
| fim de período historicamente ambíguo | UX inclusiva + `endExclusive` obrigatório para SQL |
| período aplicado só após re-agregação manual (`PeriodMismatchNotice`) | release pré-calculada por contexto; UI nunca dispara ETL |
| ausência de `as_of_date` | obrigatório e persistido em toda release |
| ausência de `metric_versions` | obrigatório em toda resposta |

## Transporte
- Front → backend: enviar `period_start` + `period_end_exclusive`; quando a API for orientada a formulário, pode enviar também `period_end_inclusive`, mas o SQL nunca recalcula o fim se o exclusivo já estiver presente.
- Backend → LLM: o mesmo contexto dentro do `EvidencePackage`, com as duas representações de fim quando houver interface humana.
- Exportações: o contexto vai no cabeçalho do arquivo exportado (rastreabilidade).