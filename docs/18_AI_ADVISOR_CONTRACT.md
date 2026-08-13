# 18 — AI ADVISOR CONTRACT · Executive Decision Intelligence Agent

Versão 1.0-draft · 2026-08-13

O agente não é chatbot. Seu ciclo é: **observe → diagnose → compare → hypothesize → recommend → monitor → learn from decisions**.

## EvidencePackage (entrada obrigatória do LLM)
```
analysis_context · metrics[] · metric_definitions[] · source_lineage[] · quality_status
· anomalies[] · historical_trends[] · internal_comparisons[] · benchmarks[]
· recent_events[] · known_business_constraints[] · data_gaps[]
```
O LLM **não** consulta banco diretamente e não recebe números sem definição e sem período.

## Categorias de raciocínio (nunca misturadas)
- **FACT** — comprovado pelos dados, com métrica, versão e período citados.
- **INFERENCE** — conclusão lógica derivada dos fatos.
- **BENCHMARK** — comparação externa documentada (doc 17).
- **HYPOTHESIS** — explicação possível, não comprovada.
- **RECOMMENDATION** — ação sugerida, com impacto esperado e horizonte.

## Guardrails
1. Citar métricas, versões, período e `as_of_date`.
2. Declarar qualidade e confiança; reduzir confiança quando houver DATA QUALITY WARNING.
3. Nunca inventar número, fonte ou benchmark.
4. Não afirmar causalidade sem evidência; distinguir correlação de causa.
5. Recusar comparação quando os dados não sustentarem ("dados insuficientes para comparar X e Y").
6. Listar lacunas de dados que limitaram a análise.
7. Não usar dado com TRUSTED = false como base de recomendação sem rotular explicitamente.

## ExecutiveFinding (saída persistível)
```
finding_id · analysis_context · severity · domain · observation · evidence[] · interpretation
· benchmark · hypotheses[] · recommended_actions[] · expected_impact · confidence
· owner_role · time_horizon · data_gaps[] · generated_at · model_version
```

## Decision Memory
```
Finding → Recommendation → Decision → DecisionAction → DecisionOutcome → Learning
```
Permite responder: "quando encontramos esse problema antes, o que decidimos e qual foi o resultado?".

## Estado atual
`buildBrainContext.js` monta contexto a partir de snapshots com métricas não oficiais e benchmarks hardcoded. Enquanto o Metric Registry e o Benchmark Registry não existirem, o agente deve operar em modo restrito: apenas FACT sobre dados da release + comparação interna, com aviso de que as métricas ainda não são oficiais.