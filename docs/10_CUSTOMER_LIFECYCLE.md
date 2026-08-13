# 10 — CUSTOMER LIFECYCLE (v1, oficial candidato)

Versão 1.0-draft · 2026-08-13 · Owner de negócio: **A DEFINIR (Diretoria Comercial)**
Substitui: regras dispersas em `clienteDim.ts`, `churnUniverse.ts`, `classifyClientStatus`, `TabChurn` (ver audit P0-04).

## Regra transversal
Toda classificação exige `as_of_date` explícito e a versão da máquina de estados. É proibido derivar estado de `new Date()`.

Evento base de atividade comercial (v1): **NF emitida** (`Invoice`), para manter coerência com a origem transacional já adotada nos KPIs. Remessa (`Dispatch`) é candidata alternativa e deve ser avaliada na reconciliação.

## Estados
| status_id | Definição | Entry event | Exit event | Janelas |
|---|---|---|---|---|
| PROSPECT | Party conhecido sem intenção registrada | criação de Party | LeadCreated | — |
| LEAD | intenção comercial registrada | LeadCreated | QuoteCreated / descarte | — |
| QUALIFIED | lead validado comercialmente | qualificação | QuoteCreated | — |
| QUOTED | orçamento emitido | QuoteCreated | ContractCreated / expiração | validade do orçamento |
| CONTRACTED | contrato/ficha criada | ContractCreated | Dispatch / cancelamento | — |
| DISPATCHED | equipamento entregue | AssetDispatched | InvoiceIssued / devolução | — |
| ACTIVE | ≥1 NF nos últimos **90 dias** | InvoiceIssued | fim da janela | inactivity_window = 90d |
| REPEAT | ≥2 NFs em janelas distintas nos últimos **12 meses** | 2ª NF | fim da janela | lookback = 12M |
| AT_RISK | última NF entre **91 e 180 dias** | vencimento de 90d | nova NF / 180d | — |
| DORMANT | última NF entre **181 e 365 dias** | vencimento de 180d | nova NF / 365d | — |
| CHURNED | sem NF por **> 365 dias** | vencimento de 365d | nova NF | — |
| REACTIVATED | NF após período ≥ 181 dias sem NF | InvoiceIssued | 90d (volta a ACTIVE) | — |

## Exceções a decidir com o negócio (bloqueiam TRUSTED)
1. Contratos de longa duração faturados esporadicamente devem contar como ACTIVE por contrato vigente, e não por NF?
2. Cliente com CAR em aberto e sem NF recente é ACTIVE?
3. Cliente sazonal (obra) deve ter janela própria por segmento?
4. NF cancelada/devolvida conta como atividade? (v1: **não conta**)
5. Cliente bloqueado por inadimplência é DORMANT ou estado próprio (BLOCKED)?

## Contrato de saída
`CustomerLifecycleSnapshot`: `customer_id`, `as_of_date`, `status_id`, `status_since`, `last_activity_date`, `recency_days`, `activity_count_12m`, `revenue_12m`, `lifecycle_version`, `evidence[]`.

## Migração
1. Implementar como serviço único no backend, sem alterar telas.
2. Rodar em paralelo às regras atuais e produzir relatório de reconciliação por cliente.
3. Aprovar divergências com o negócio.
4. Só então as abas passam a ler o snapshot oficial e as regras antigas são retiradas.