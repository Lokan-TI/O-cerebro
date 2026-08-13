# 17 — BENCHMARK GOVERNANCE

Versão 1.0-draft · 2026-08-13

## Problema atual (audit P1-07)
Referências de mercado e faixas de comparação estão em código (`src/lib/rentalIndustry.js`, `heroPhrases.js`, prompts do agente), sem fonte, data, metodologia, peer group ou aprovação. Isso é **proibido**.

## Entidades
`BenchmarkDefinition` · `BenchmarkValue` · `BenchmarkSource`

Campos obrigatórios de um valor de benchmark:
```
benchmark_id · metric_definition_id · industry · subindustry · business_model · company_size
· geography · peer_group · company · value · value_min · value_target · value_max · unit
· period_start · period_end · methodology · source_name · source_url · publication_date
· retrieved_at · confidence · approved_by · valid_from · valid_until
```

## Regras absolutas
1. Benchmark só existe com proveniência verificável (relatório público, demonstração financeira, IR, associação setorial, pesquisa citável).
2. Comparação exige compatibilidade de definição de métrica, período, geografia e modelo de negócio.
3. Sem benchmark comparável e confiável, a resposta é exatamente:
   > Benchmark externo confiável indisponível para este contexto.
4. Estimativa nunca é apresentada como benchmark; se usada, é rotulada como HYPOTHESIS.
5. Benchmark interno (entre filiais, entre períodos) é sempre permitido e deve ser preferido — mas rotulado como comparação interna, não externa.

## Migração do conteúdo atual
As referências hoje embutidas (empresas de locação de máquinas e equipamentos) tornam-se **candidatas a peer group**, sem valores, até que exista fonte publicada com data e metodologia. Até lá, as telas exibem apenas comparação interna.