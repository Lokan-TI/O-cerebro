# 08 — Source Semantic Contract: Lokan ERP (SISLOC / SQL Server)

- **Source ID lógico:** `lokan_erp`
- **Tipo:** SQL Server (leitura), acesso via `sqlServerQuery` / `SqlGuard`
- **Versão do contrato:** v1.0 (2026-08-13)
- **Status:** Draft — pendente de validação com donos de negócio
- **Dicionário oficial da fonte:** view `v_Dicionario_Dados`
  (colunas: `Tabela`, `Coluna`, `Caption`, `Options`, `Tipo`, `Tam_Maximo`, `Nulo`, `Chave_estrangeira`).
  Linhas com `Coluna = ''` descrevem a **tabela**; as demais descrevem **colunas**.
  Toda validação de schema deve usar esta view — nunca varreduras amplas em `sys.*` (causam timeout).

## 1. Classificação
| Item | Definição |
|---|---|
| Criticidade | Alta — base transacional primária do negócio |
| Sensibilidade | Contém PII (CPF/CNPJ, endereço, contato) → dados pessoais |
| Modo de acesso | Somente leitura, credencial via secret da plataforma |
| Frescor | Consulta ao vivo + snapshots versionados (`ErpSnapshot`) |

## 2. Objetos de origem sob contrato

| Objeto | Grão (uma linha = ) | Uso canônico |
|---|---|---|
| `nf` | Uma nota fiscal emitida | Documento fiscal / receita faturada |
| `cliente` | Um cadastro de cliente | Entidade Customer |
| `financas_car` | Um título a receber | Receita realizada / atribuição de vendedor |
| `financas_car_comissao` | Comissão por título | **Única** fonte válida de vendedor |
| `financas_cap` | Um título a pagar | Consumo por fornecedor |
| `est_mov` / `est_movitem` | Movimento / item de movimento | Locações e operação |
| `fl_remessa` | Uma remessa | Ciclo logístico (usar `dt_saida`) |
| `mkt_orcamento` | Um orçamento | Topo do funil comercial |

## 3. Mapeamentos semânticos validados

| Campo de origem | Significado real (verificado) | Regra canônica |
|---|---|---|
| `nf.vl_faturamento` | Campo **sintético pré-calculado** do ERP | Não equivale ao relatório "Receita por Grupo"; não recompor manualmente |
| `nf.cd_pessoa_fun` | Funcionário que **emitiu** a NF (back-office) | ❌ Nunca usar como vendedor |
| `financas_car_comissao` | Relação título → vendedor comissionado | ✅ Fonte de atribuição de vendedor |
| `fl_remessa.dt_liberacao` | NULL em toda a base de produção | ❌ Não usar; usar `dt_saida` como proxy operacional |
| `cd_empresa` | Empresa/filial do documento | Requer mapeamento explícito para Branch canônico (ambiguidade aberta) |

## 4. Contratos de consulta (obrigatórios)
1. **Datas sargáveis:** comparação por faixa (`>= DATEFROMPARTS(...) AND < DATEADD(...)`). Proibido `YEAR()`/`MONTH()` sobre coluna de data.
2. **Execução serial:** nenhuma consulta investigativa em paralelo (instabilidade do pool).
3. **Sem `LIKE` curinga** em metadados de sistema.
4. **Somente `SELECT`/`WITH`**, um único comando, validado pelo `SqlGuard` e auditado em `ErpQueryAudit`.
5. **Limite de linhas** sempre aplicado (default 5.000).

## 5. Divergências conhecidas (não resolvidas)
- Receita do ERP para `empresa 001` ≠ soma da tabela `nf`.
- "Receita por Grupo" (pré-faturamento operacional) mede fato diferente de NFs emitidas.
- Ausência de resolução de identidade canônica entre múltiplas fontes.

## 6. Perguntas abertas para os donos de negócio
1. Qual documento define **Receita** oficial: NF emitida, título a receber ou pré-faturamento?
2. Mapa oficial `cd_empresa` → filial/unidade.
3. Regra oficial de vendedor quando há mais de um comissionado no mesmo título.

## 7. Critério de aceite do onboarding
- [ ] Perguntas da seção 6 respondidas e registradas em ADR
- [ ] Métrica de Receita registrada no Metric Registry com dono e versão
- [ ] Mapeamento Branch publicado
- [ ] Reconciliação ERP × plataforma dentro de tolerância acordada