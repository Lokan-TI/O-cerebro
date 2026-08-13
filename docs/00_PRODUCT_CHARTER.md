# 00 — PRODUCT CHARTER · O CÉREBRO

Versão 1.0 · 2026-08-13 · Status: DRAFT para aprovação executiva

## 1. Definição do produto
O Cérebro é o **Executive Intelligence & Decision Operating System** do ecossistema. Não é um BI: é a camada que transforma sistemas de origem em uma representação confiável, histórica e integrada da organização, e sustenta decisões com evidência.

Composição: **Data Platform + Semantic Layer + Analytics + Executive Intelligence + AI Advisor + Decision Memory**.

## 2. Perguntas que o produto existe para responder
o que aconteceu · o que está acontecendo · por que aconteceu · onde há risco · onde há oportunidade · o que provavelmente acontecerá · qual ação tomar · qual decisão anterior deu resultado.

## 3. Usuários e papéis
| Papel | Necessidade | Superfície |
|---|---|---|
| Executivo (CEO/Diretoria) | saúde do negócio, riscos, prioridades, decisões | Executive Cockpit, The Brain |
| Gestor comercial | funil, conversão, carteira, concentração | Revenue & Growth, Customer Journey |
| Gestor de operações/frota | utilização, disponibilidade, manutenção, yield | Fleet & Operations |
| Financeiro | recebíveis, inadimplência, DSO, exposição, custos | Finance & Risk |
| Data steward | métricas, dicionário, qualidade, mappings | Data Governance |
| Engenharia de dados | fontes, ingestão, SQL, drift, logs | Admin / Engineering |

## 4. Princípios (não negociáveis)
1. Verdade dos dados antes de estética.
2. Uma métrica, uma definição oficial por versão.
3. Dashboard não implementa regra de negócio.
4. Nenhum insight de IA sem evidência; nenhum benchmark sem proveniência.
5. Nenhuma análise histórica depende implicitamente da data de hoje.
6. Nenhuma agregação multi-fonte antes de identity resolution.
7. Credencial nunca é dado empresarial comum.
8. Nada relevante de produção hardcoded no front-end.
9. Todo KPI conhece origem, versão, período e qualidade.
10. Modelo de origem e modelo canônico nunca se confundem.

## 5. Independência de fornecedor
Sisloc, SQL Server, MySQL, RD Station, Google e Base44 são **sistemas de origem ou hospedagem**. Nenhuma decisão de modelo canônico, métrica ou lifecycle pode depender de sua nomenclatura.

## 6. Escopo da fase atual
**Dentro:** auditoria, documentação fundamental, source discovery da fonte Lokan, modelo canônico inicial, metric registry, AnalysisContext, quality framework, plano de migração.
**Fora:** novos dashboards, novas abas, novas métricas não registradas, refatoração ampla antes do marco de documentação.

## 7. Definição de pronto (resumo)
definição de negócio aprovada · fonte identificada · mapping canônico definido · versão de métrica · AnalysisContext respeitado · testes de dados verdes · segurança validada · lineage disponível · documentação atualizada · observabilidade · reconciliação com legado quando aplicável.

## 8. Métricas de sucesso do próprio produto
- % de KPIs exibidos com origem, versão, período e qualidade declarados → meta 100%.
- Nº de métricas com definição concorrente → meta 0.
- % de fontes com Source Semantic Contract aprovado → meta 100% antes de alimentar KPI.
- Tempo entre pergunta executiva e resposta com evidência.
- % de recomendações da IA que se tornaram Decision com Outcome medido.

## 9. Riscos estratégicos
instabilidade das fontes de origem · ausência de owner de negócio por métrica · pressão por telas antes de contratos · PII em exportações · custo/latência de LLM · dependência de conhecimento tácito sobre o ERP.