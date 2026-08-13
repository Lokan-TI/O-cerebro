# 02 — ARCHITECTURE RISK REGISTER

Versão 1.0-draft · 2026-08-13

| id | Risco | Prob. | Impacto | Exposição hoje | Mitigação | Fase |
|---|---|---|---|---|---|---|
| R-01 | Decisão executiva tomada sobre métrica não reconciliada (receita) | alta | crítico | KPIs de faturamento em produção | selo NÃO OFICIAL + reconciliação com relatório do ERP | 0 / 4 |
| R-02 | Vazamento de credencial de ERP armazenada em entidade | média | crítico | `ErpDataSource.password` | `secret_reference` + migração | 0 |
| R-03 | Exfiltração ou DoS via query livre no ERP de produção | média | crítico | aba Query SQL | mover para Admin, allowlist, limites, auditoria | 0 |
| R-04 | Dupla contagem de clientes ao consolidar fontes | alta | alto | `mergeSnapshots.js` | identity resolution; rótulo "soma por fonte" até então | 0 / 3 |
| R-05 | Números divergentes entre abas por filtro não universal | alta | alto | filtro local em Comparativo, período aplicado por re-agregação | AnalysisContext único | 1 / 4 |
| R-06 | Instabilidade da fonte Lokan derrubando análises | alta | alto | timeouts recorrentes de gateway | ingestão assíncrona, isolamento por fonte, release pré-calculada | 2 / 3 |
| R-07 | Recomendação de IA baseada em benchmark inventado | média | alto | benchmarks hardcoded | Benchmark Registry + regra de indisponibilidade | 0 / 7 |
| R-08 | Exposição indevida de PII em exportações | alta | alto | export completo de cadastro sem controle de campo | classificação PII + field-level security + auditoria | 0 / 3 |
| R-09 | Perda de histórico por ausência de camada bruta | alta | alto | nenhuma retenção de raw | Raw plane com lineage | 3 |
| R-10 | Publicação parcial de dados (janela inconsistente) | média | alto | `is_current` em duas operações | DatasetRelease atômica | 0 / 4 |
| R-11 | Conhecimento do ERP permanecer tácito | alta | médio | regras aprendidas por tentativa | SourceSemanticContract versionado | 2 |
| R-12 | Drift de schema quebrar métricas silenciosamente | média | médio | nenhuma detecção | drift monitor com proposta | 2 |
| R-13 | Semântica financeira incorreta (caixa apresentado como margem) | alta | alto | abas financeiras | renomeação e definições aprovadas | 1 / 4 |
| R-14 | Custo/latência de LLM sem observabilidade | média | médio | agente em produção | métricas de LLM (latência, custo, falha) | 7 |
| R-15 | Pressão por novas telas antes dos contratos | alta | alto | histórico do produto | freeze da Phase 0 + Definition of Done | 0 |
| R-16 | Ausência de owner de negócio por métrica | alta | crítico | nenhum owner definido | nomeação formal na Phase 1 | 1 |