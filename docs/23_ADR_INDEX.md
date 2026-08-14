# 23 — ARCHITECTURE DECISION RECORDS (índice + ADRs iniciais)

Versão 1.0-draft · 2026-08-13
Formato: contexto · decisão · alternativas · consequências · status.

| ADR | Título | Status |
|---|---|---|
| ADR-001 | Canonical Customer Identity | PROPOSED |
| ADR-002 | Customer Lifecycle Definition | PROPOSED |
| ADR-003 | Revenue Source of Truth | PROPOSED |
| ADR-004 | Analysis Context como contrato único | PROPOSED |
| ADR-005 | Benchmark Governance | PROPOSED |
| ADR-006 | Snapshot / DatasetRelease Publication Strategy | PROPOSED |
| ADR-007 | Secret Management para fontes de dados | PROPOSED |
| ADR-008 | Isolamento de concorrência por fonte | PROPOSED |
| ADR-009 | `pessoa` mapeia Party, não Customer | PROPOSED |
| ADR-010 | Aprovação de métricas do registry (CFO) | AWAITING_APPROVAL |

---

## ADR-001 · Canonical Customer Identity
**Contexto:** múltiplas fontes/filiais com IDs próprios; consolidação atual soma clientes sem resolution.
**Decisão:** emitir IDs canônicos (`CUS-…`) e manter crosswalk com match_method e confidence; proibir agregação multi-fonte antes de resolution.
**Alternativas:** usar `cd_pessoa` da matriz (rejeitada: quebra em multi-base); usar CNPJ como chave (rejeitada: ausente/inválido em parte da base).
**Consequências:** contagens multi-fonte só após Phase 3; até então rotuladas como soma por fonte.

## ADR-002 · Customer Lifecycle Definition
**Decisão:** uma única máquina de estados versionada (doc 10), atividade baseada em NF, `as_of_date` obrigatório; regras atuais concorrentes serão retiradas após reconciliação.
**Consequências:** números de churn mudarão; exige aprovação do negócio e comunicação.

## ADR-003 · Revenue Source of Truth
**Decisão:** `nf.vl_faturamento` permanece como métrica de origem não confiável (`erp_invoice_synthetic_amount`); `Revenue` oficial só após reconciliação com o relatório do ERP e definição de impostos/frete/devolução.
**Consequências:** KPIs de receita ficam com selo NÃO OFICIAL até Phase 4.

## ADR-004 · Analysis Context
**Decisão:** contrato único obrigatório (doc 13); filtros locais proibidos; toda resposta ecoa o contexto e a qualidade.

## ADR-005 · Benchmark Governance
**Decisão:** benchmark só com proveniência completa; ausência é respondida explicitamente; valores hardcoded serão removidos.

## ADR-006 · DatasetRelease Publication
**Decisão:** substituir os três snapshots independentes por uma release única com ponteiro atômico e quality gates.

## ADR-007 · Secret Management
**Decisão:** `secret_reference` no lugar de senha em entidade; resolução exclusiva no backend; remoção do campo após migração.

## ADR-008 · Isolamento por fonte
**Decisão:** pool, fila e rate limit por `source_id`; remoção do mutex global; ETL fora do caminho de navegação.

## ADR-009 · `pessoa` → Party
**Decisão:** preservar a semântica ampla da tabela; papéis derivam dos flags; `Customer` é um papel, não a entidade.

## ADR-010 · Aprovação de métricas do registry (CFO)
**Contexto:** o registry executável (v0.1) cobre MTR-001, 006, 007, 017, 018, 019, 020, 021 e 022, todas com `trusted = false`. A reconciliação legado × canônico está persistida (Receita aderente a 0%; divergências de contagem justificadas). Falta a aprovação do dono de negócio para o selo OFICIAL.
**Decisão (proposta para assinatura):** o CFO aprova, métrica a métrica, respondendo às `blocking_questions` registradas — em especial: (a) `vl_faturamento` como Receita oficial; (b) tratamento de NFs válidas com valor zerado; (c) denominador do ticket médio por cliente faturado; (d) inclusão de acréscimos/descontos no saldo de recebíveis; (e) convenção de DSO. Após assinatura, o campo `trusted` da métrica vira `true` na versão seguinte do registry e o selo NÃO OFICIAL sai dos dashboards que a exibem.
**Alternativas:** aprovação em bloco sem responder às questões (rejeitada: repete o problema das definições implícitas); aprovação técnica pelo Data Platform (rejeitada: dono de negócio é obrigatório pelo doc 12).
**Consequências:** até a assinatura, nenhuma métrica pode ser exibida como oficial; a release (`DatasetRelease`) segue publicável, mas carrega métricas v0.1 não confiáveis.
**Status:** AWAITING_APPROVAL — pendente exclusivamente da assinatura do CFO.