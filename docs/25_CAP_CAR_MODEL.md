# 25 — CAP & CAR: MODELO, RELAÇÕES E SANEAMENTO

Versão 1.1-draft · 2026-08-25 · Fonte: `v_Dicionario_Dados` (dicionário oficial do Sisloc, SQL Server)

## 1. Objetivo das tabelas

| Tabela | Papel | Grão |
|---|---|---|
| `car` | **Contas a Receber** — cada linha é um título/parcela a receber (duplicata, boleto, cartão), gerado por NF, fatura de locação, devolução ou lançamento manual | 1 linha = 1 título CAR (`cd_lan`) |
| `cap` | **Contas a Pagar** — cada linha é um título/parcela a pagar a um credor (fornecedor, tributo, contrato) | 1 linha = 1 título CAP (`cd_lan`) |

Ciclo de vida de um título: **emissão** (`dt_emi_*`) → **vencimento** (`dt_ven_*`) → **baixa** (`dt_bai_*`, quando liquidado) → opcionalmente **cancelamento** (`dt_cancelamento`, só no CAR) ou **renegociação** (`cd_renegociacao_*`).

Estados derivados usados no O Cérebro (mesma regra do bloco analítico do snapshot):
- **Em aberto**: `dt_bai IS NULL` (CAR: e `dt_cancelamento IS NULL`)
- **Baixado**: `dt_bai IS NOT NULL`
- **Vencido**: `dt_ven < hoje` e em aberto
- **Cancelado** (CAR): `dt_cancelamento IS NOT NULL`

## 2. Estrutura

- `car`: 75 colunas — valores (`vl_pre_car` previsto, `vl_acr_car`, `vl_des_car`, juros/multa/despesa, 6 retenções tributárias), datas do ciclo, vínculos de origem (NF, CT-e, devolução, adiantamento, renegociação), cobrança (tipo, status, linha digitável, cartão), integrações (BVS, IntelRisk) e trilha de auditoria (`lad_*`).
- `cap`: 73 colunas — valores (`vl_pre_cap` + retenções, incluindo bases PCC), datas do ciclo + agendamento/autorização de pagamento, vínculos (NF, contrato, borderô, adiantamento, renegociação), forma de pagamento (boleto, cheque, banco) e trilha de auditoria.
- Colunas marcadas "REMOVER EM VERSÕES FUTURAS" (`fl_origem`, `old_fl_provisorio`, `dt_boleta`): depreciadas pelo próprio fornecedor — não usar.

## 3. Relações (FKs declaradas no dicionário)

| FK | Aponta para | Significado |
|---|---|---|
| `car.cd_pessoa_cli` / `cd_pessoa_sac` / `cd_pessoa_ven` | `pessoa` | Cliente, sacado e vendedor do título |
| `cap.cd_pessoa_cre` | `pessoa` | Credor (fornecedor) |
| `car.cd_empresa_gestora` | `empresa` | Empresa/filial dona do título — **CAP não tem dimensão empresa** |
| `cd_conta` (ambas) | `conta` / usada como `plano.cd_planfin` | Natureza financeira (balancete usa `plano`) |
| `cd_tipocob` (ambas) | `tpcobranca` | Tipo de cobrança (`ds_tipocob`) |
| `cd_origem` (ambas) | `nf` | NF que gerou o título |
| `cd_controle` (ambas) | `controle` | Documento de origem genérico |
| `car.cd_fatura` | `faturacar` · `cap.cd_fatura` → `cap_fatura` | Duplicata / pagamento agrupado |
| `cd_renegociacao_*` (ambas) | `financas_renegociacao` | Renegociações |
| `cap.cd_borderopagto` | `cap_borderopagto` | Borderô de pagamento |
| `cd_lan` (ambas) | `lanca` | Lançamento financeiro |

## 4. Riscos conhecidos para saneamento

1. **CAP sem empresa** — impossibilita DRE por filial sem regra de rateio (já sinalizado na aba Financeiro).
2. **Cancelamento assimétrico** — CAR tem `dt_cancelamento`; CAP não (usar `fl_status`/`fl_status_titulo`, domínio a mapear).
3. **Identidade de pessoa** — cliente/credor sofrem do mesmo problema de duplicidade por CNPJ/CPF já mapeado no Party (doc 09); saneamento de CAP/CAR depende da resolução de identidade.
4. **Valor "previsto" vs liquidado** — `vl_pre_*` é o valor de face; o liquidado exige `vl_pre + vl_acr − vl_des` (regra já usada no balancete). Exportações devem trazer as parcelas de valor separadas.
5. **Títulos órfãos** — `cd_origem`/`cd_controle` nulos em lançamentos manuais; a exportação com colunas de origem permite quantificá-los.

## 5. Ferramenta entregue

Exportação CAP/CAR na aba **Financeiro → Exportar CAP/CAR**:
- Filtros: documento (CAR/CAP), período de emissão, situação (todos/aberto/baixado/vencido/cancelado), empresa gestora (CAR).
- Seleção de colunas: todas as colunas da tabela base + colunas relacionadas (pessoa, empresa, natureza financeira, tipo de cobrança), com captions do dicionário.
- Backend `exportFinanceiro` com whitelist de colunas (nada fora do catálogo entra no SQL), limite de 10.000 linhas por extração, ordenado por emissão decrescente.
- CSV compatível com Excel (BOM, `;`, documentos como texto).

Este é o primeiro passo do saneamento: extrair a base bruta com as relações resolvidas para auditoria externa antes de definir as regras canônicas de Receivable/Payable (doc 03).

## 6. Contrato de previsibilidade de caixa

Implementação: `analyzeCashFlowForecast` + **Financeiro → Fluxo & previsibilidade**.

A análise separa explicitamente fato ERP de inferência:

| Camada | Regra temporal | Natureza |
|---|---|---|
| Passado realizado | CAP `dt_bai_cap`; CAR `dt_bai_car` | Fato de caixa realizado |
| Presente | títulos sem baixa; vencidos quando `dt_ven_* < data de corte` | Posição de carteira |
| Futuro comprometido CAP | `dt_agendpagto` quando houver agendamento futuro; senão `dt_ven_cap` | Compromisso registrado no ERP |
| Futuro comprometido CAR | `dt_ven_car` | Direito a receber registrado no ERP |
| Futuro esperado | calendário comprometido deslocado pela mediana histórica de `DATEDIFF(day, vencimento, baixa)`; CAP agendado não é deslocado | Inferência estatística, nunca fato ERP |

Valor financeiro em todas as camadas: `vl_pre + vl_acr - vl_des`, mantendo a mesma regra do balancete.

Regras de completude:
- CAP aberto: `dt_bai_cap IS NULL` e status diferente de 40; o código 5 é usado apenas para marcar **provisório** conforme a regra atual do Cérebro, não para excluir outros títulos sem baixa.
- CAR aberto: `dt_bai_car IS NULL`, `dt_cancelamento IS NULL` e status diferente de 40.
- CAP vencido sem agendamento futuro entra como pressão imediata no primeiro dia da projeção.
- CAR vencido é mostrado separadamente como risco de cobrança e **não é contado como entrada imediata** na previsão base, evitando superestimar liquidez.
- CAP permanece consolidado: não existe dimensão física de empresa comprovada em `cap`.

KPIs produzidos:
- picos históricos e futuros de entrada/saída por dia;
- saldo diário e acumulado;
- necessidade máxima de liquidez partindo de saldo zero;
- cobertura de saídas (`entradas esperadas / saídas esperadas`);
- janelas de 7/14/30/60/90 dias;
- atraso/antecipação médio e mediano de CAP e CAR;
- maiores fornecedores/obrigações e clientes/recebimentos que explicam os picos;
- padrão médio por dia da semana.

Limitação deliberada: a necessidade máxima de liquidez **não considera o saldo bancário inicial**. Para transformá-la em projeção de saldo de caixa, é necessário conectar o saldo disponível das contas bancárias na data de corte.