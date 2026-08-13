# 03 — DOMAIN MODEL (Canonical Business Model v0.1)

Versão 0.1 · 2026-08-13 · Status: DRAFT
Regra: nenhuma entidade canônica nasce TRUSTED. Toda entidade declara grain, PK, mapeamento de origem, timestamps e classificação PII.

## Convenções
- IDs canônicos próprios: `CUS-000000000`, `AST-…`, `RNT-…`, `INV-…` (nunca o ID do sistema de origem).
- Todo registro carrega: `canonical_id`, `organization_id`, `source_mappings[]`, `valid_from`, `valid_until`, `record_version`.
- Timestamps distinguem **event time** (quando ocorreu) de **effective time** (quando passou a valer) e `ingested_at`.

---

## Identity & Organization
| Entidade | Grain | Origem candidata (Lokan) | Notas |
|---|---|---|---|
| Organization | 1 por empresa jurídica | `empresa` | mapeamento de `cd_empresa` ainda ambíguo (ver audit P1) |
| Branch | 1 por filial operacional | `empresa` / `ErpDataSource.branch_code` | hoje filial e banco estão acoplados |
| Employee | 1 por colaborador | `pessoa` com `fl_funcion_pessoa` | papel de Party |
| User / Role | 1 por usuário da plataforma | Base44 `User` | RBAC/ABAC do Cérebro |

## Party & Customer
| Entidade | Grain |
|---|---|
| Party | 1 por pessoa/organização do mundo real (após entity resolution) |
| PartyRole | 1 por papel exercido: Customer, Supplier, Employee, Carrier, Contact |
| CustomerIdentifier | 1 por identificador (CNPJ, CPF, e-mail, ID de origem) |
| Address / Contact | 1 por endereço/contato, com tipo (fiscal, cobrança, entrega) |
| CustomerLifecycleEvent | 1 por transição de estado, com `as_of_date` |
| CustomerLifecycleSnapshot | 1 por cliente × `as_of_date` |

**Decisão semântica registrada:** `pessoa` **não** é `Customer`. `pessoa` → `Party`; os flags `fl_cliente_pessoa`, `fl_fornec_pessoa`, `fl_funcion_pessoa` → `PartyRole`. Simplificar para Customer destruiria a semântica e duplicaria contagens.

## Commercial
Lead · Opportunity · Quote · Proposal · Seller · SalesActivity · SalesStageEvent
Origem candidata: `mkt_orcamento` (hoje inacessível/vazio), RD Station CRM. Grain de Quote = 1 por orçamento; Seller vem de relação de comissão, não do emissor da NF.

## Rental
RentalContract (`fich_loc`, PK `cd_controle`) · RentalItem · Dispatch (`fl_remessa`, PK `cd_flremessa`) · Return · RentalExtension · Cancellation · RentalStatusEvent
**Ambiguidade aberta:** ficha existe sem locação efetiva; `dt_liberacao` é nula em produção, `dt_saida` é usada como proxy de ativação. Precisa decisão de negócio sobre qual evento ativa o contrato.

## Fleet
Product · EquipmentModel · Asset · AssetStatus · AssetAvailability · AssetUtilizationEvent · AssetTransfer
Origem candidata: `est_mov`, `est_movitem`, patrimônios.

## Finance
Invoice (`nf`, PK `cd_nf`) · InvoiceItem · Receivable (`car`) · Payment · Payable (`cap`) · CostEvent · TaxEvent · Commission (`financas_car_comissao`)
`Invoice.gross_amount` **não** é `nf.vl_faturamento` até reconciliação: hoje esse campo é `SourceMetric.erp_invoice_synthetic_amount` (TRUSTED = false).

## Maintenance
MaintenanceWorkOrder · MaintenanceEvent · Inspection · DowntimeEvent · MaintenanceCost — fonte ainda não descoberta; bloqueia métricas de custo de manutenção e disponibilidade.

## Marketing
Campaign · Channel · LeadSource · Touchpoint · MarketingSpend · AttributionEvent — origem: RD Station / Google; hoje representado por dados estáticos de protótipo (RETIRE).

## Supplier
Supplier (PartyRole) · Purchase · SupplierInvoice · SupplierPayment (`cap`).

---

## Cobertura atual (honesta)
| Domínio | Cobertura canônica | Bloqueio |
|---|---|---|
| Party & Customer | parcial | entity resolution ausente |
| Finance | parcial | fonte da verdade de receita não reconciliada |
| Rental | parcial | evento de ativação indefinido |
| Fleet | inicial | profiling pendente |
| Commercial | mínima | `mkt_orcamento` indisponível |
| Maintenance | inexistente | fonte não localizada |
| Marketing | inexistente | somente dados de protótipo |