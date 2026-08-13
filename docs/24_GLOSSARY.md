# 24 — BUSINESS GLOSSARY

Versão 0.1 · 2026-08-13 · Status: DRAFT (owners a definir)
Cada termo tem definição, owner, sinônimos, **anti-definição** (o que ele NÃO é) e métricas relacionadas.

| Termo | Definição (v1 proposta) | Anti-definição | Métricas |
|---|---|---|---|
| Party | pessoa física ou jurídica conhecida pela organização | não é cliente | — |
| Cliente | Party com papel Customer e ao menos uma NF | não é "registro na tabela pessoa" | MTR-016 |
| Cliente ativo | cliente com NF nos últimos 90 dias (`as_of_date`) | não é "flag ativo do ERP"; não é "tem CAR em aberto" | MTR-008 |
| Cliente novo | cliente cuja **primeira NF** ocorreu no período | não é "cadastrado no período" | MTR-004 |
| Cadastro do período | Party com papel Customer criado no período | não é cliente novo | MTR-016 |
| Cliente recorrente | ≥2 NFs em janelas distintas em 12 meses | não é "duas NFs no mesmo dia" | MTR-013 |
| Cliente em risco | última NF entre 91 e 180 dias | não é churn | — |
| Churn | sem NF por mais de 365 dias, em `as_of_date` | não é "inativo no ERP"; não é "sem CAR aberto" | MTR-010 |
| Reativado | NF após ≥181 dias sem NF | não é cliente novo | MTR-012 |
| Faturamento | valor bruto das NFs válidas do período | não é caixa recebido; não é CAR | MTR-001 |
| Receita | sinônimo de faturamento bruto na v1 | não é receita líquida | MTR-001 |
| Receita líquida | faturamento menos devoluções, cancelamentos e descontos | não é faturamento | MTR-002 |
| Recebível (CAR) | direito de recebimento em aberto em uma data | não é receita do período | MTR-020 |
| Pagável (CAP) | obrigação de pagamento | não é custo do período | — |
| Visão de caixa | diferença entre recebíveis e pagáveis em uma data | **não é margem, não é resultado, não é EBITDA** | MTR-030 |
| Margem bruta | receita menos custo direto | não é CAR−CAP | MTR-031 |
| Markup | multiplicador de preço sobre custo | não é margem | MTR-034 |
| Contrato / ficha de locação | acordo registrado de locação | não é locação ativa | — |
| Remessa | entrega/saída física do equipamento | não é contrato | — |
| Locação ativa | contrato com equipamento em posse do cliente | não é ficha aberta | — |
| Utilização | proporção do tempo/valor em que o ativo gera receita | não é "ativo alugado alguma vez" | MTR-040 |
| Ticket médio | receita por cliente faturado | não é receita por cadastro | MTR-006 |
| Concentração | share dos N maiores clientes na receita | não é participação do maior cliente isolado | MTR-007 |
| Filial | unidade operacional | não é banco de dados nem fonte | — |
| Fonte | sistema/banco de origem dos dados | não é filial | — |
| Release de dados | versão publicada e consistente de todos os dados analíticos | não é snapshot isolado | — |
| Oficial | métrica registrada, versionada e com quality gate aprovado | não é "aparece na tela" | — |