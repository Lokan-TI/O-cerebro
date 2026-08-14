# 11 — CUSTOMER JOURNEY (Fase 5)

Versão 1.0-draft · 2026-08-14 · status: AWAITING_APPROVAL
Objetivo: ligar o plano comercial (CRM/orçamentos) ao operacional (locações/remessas) e ao financeiro (NF/recebíveis) sobre um **modelo de eventos** único, para que a jornada de cada cliente seja reproduzível ponta a ponta.

## 1. Por que eventos (e não mais JOINs de dashboard)
Hoje cada aba reconstrói a jornada com seu próprio JOIN sobre o schema físico. Resultado: números que não se somam entre telas e nenhuma linha do tempo por cliente.
Regra da Fase 5: **um evento por fato de negócio**, com grão declarado, `party_id` canônico e linhagem da origem. Dashboards leem eventos, nunca o schema físico.

## 2. Modelo de evento canônico (`CustomerEvent`)
Grão: um fato de negócio por cliente, por momento.

| Campo | Descrição |
|---|---|
| `event_id` | ID determinístico (`tipo:origem:pk`) — idempotente por reprocesso |
| `party_id` | Cliente canônico (doc 09 — resolução determinística por CNPJ/CPF) |
| `cd_empresa` | Empresa/filial do fato |
| `event_type` | Tipo (seção 3) |
| `occurred_at` | Data do fato no ERP (nunca a data de processamento) |
| `stage` | `COMERCIAL` · `OPERACIONAL` · `FINANCEIRO` |
| `amount` | Valor em BRL quando aplicável |
| `source_table` / `source_pk` | Linhagem obrigatória |
| `snapshot_version` | Release que materializou o evento |

## 3. Tipos de evento — v1 (escopo fechado)
Comercial: `LEAD_CRIADO` (CRM) · `ORCAMENTO_EMITIDO` (`mkt_orcamento`) · `ORCAMENTO_APROVADO`
Operacional: `CONTRATO_ABERTO` · `REMESSA_SAIDA` (`fl_remessa.dt_saida` — proxy aprovado) · `RETORNO_EQUIPAMENTO`
Financeiro: `NF_EMITIDA` (`nf`, exclui `fl_can_nf = 'S'`) · `TITULO_ABERTO` · `TITULO_LIQUIDADO` · `TITULO_VENCIDO`

Fora do escopo v1: eventos de atendimento/pós-venda e sinais de marketing (sem fonte confiável hoje).

## 4. Métricas que a jornada habilita (a registrar, não implementar antes de aprovar)
- Tempo cadastro → 1ª NF (já existe no legado como conversão; aqui vira derivado de evento)
- Orçamento → contrato (taxa e tempo), por vendedor e empresa
- Contrato → NF (vazamento operacional)
- NF → liquidação (ponte com DSO, MTR-022)

## 5. Questões bloqueantes (donos de negócio)
1. `ORCAMENTO_APROVADO` existe como estado explícito no ERP ou é inferido pelo contrato subsequente?
2. Um contrato sem NF no período é vazamento ou faturamento diferido legítimo?
3. Reabertura/prorrogação de contrato é novo `CONTRATO_ABERTO` ou continuação?
4. Lead do CRM sem documento válido pode entrar na jornada sem `party_id`?

Enquanto abertas, a jornada permanece **NÃO OFICIAL**.

## 6. Sequência de entrega
1. Este documento aprovado (grão + tipos + questões).
2. Contrato de leitura por tipo de evento (SQL por origem, com exclusões e datas sargable).
3. Materialização em release (`DatasetRelease`), sem consulta ao vivo nas telas.
4. Timeline por cliente na experiência, lendo apenas eventos.
5. Registro das métricas da seção 4 no Metric Registry, com reconciliação contra o legado.

## 7. Regras invioláveis
- Nenhum evento sem `party_id` canônico e linhagem.
- `occurred_at` sempre do ERP; nada depende da data atual.
- Reprocesso é idempotente por `event_id`.
- Nenhuma tela implementa regra de negócio de jornada.