# 08 — Source Semantic Contract: Lokan ERP (SISLOC / SQL Server)

- **Source ID lógico:** `lokan_erp`
- **Tipo:** SQL Server (leitura), acesso via `sqlServerQuery` / `SqlGuard`
- **Versão do contrato:** v1.1 (2026-08-25)
- **Status:** Em reconciliação técnica com o ERP; semântica de negócio ainda não promovida a TRUSTED
- **Nomes físicos confirmados (2026-08-13, via `v_Dicionario_Dados`):** `pessoa` (não `cliente`), `car` (não `financas_car`), `cap` (não `financas_cap`). Descoberta automatizada: Trust Score **86/100**, 800 tabelas, 15.435 colunas (76,8% documentadas), 199 colunas com dado pessoal.
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

Os objetos abaixo são físicos e foram encontrados no `v_Dicionario_Dados`, salvo indicação contrária. O "uso canônico" não autoriza substituir a lógica de um relatório nativo do Sisloc por uma soma simplificada.

| Objeto | Grão (uma linha = ) | Uso técnico |
|---|---|---|
| `nf` | Uma nota fiscal | Documento fiscal; `vl_faturamento` é campo sintético do ERP |
| `pessoa` | Um cadastro de pessoa | Pessoa/cliente/fornecedor conforme flags do cadastro |
| `fich_loc` | Uma ficha de locação | Documento comercial/operacional de locação |
| `fl_remessa` | Uma remessa | Evento físico de saída; `dt_saida` é data operacional observada |
| `fl_fatura` | Uma fatura de locação | Pré-faturamento vinculado à ficha e, quando emitida, à NF |
| `nffatur` | Uma parcela/registro financeiro da NF | Rateio financeiro utilizado pelo relatório nativo Receita por Grupo |
| `mkt_orcamento` | Um orçamento comercial | Topo do funil; possui datas distintas de abertura, emissão, aprovação e cancelamento |
| `car` | Um título a receber | Contas a receber |
| `cap` | Um título a pagar | Contas a pagar |
| `financas_car_comissao` | Uma atribuição de comissão | Pessoa comissionada por NF; o papel "vendedor" depende do KPI |
| `est_mov` / `est_movitem` | Movimento / item de movimento | Estoque/operação |
| `v_nf_emissao` | **View observada no log do ERP** | Dimensão de emissão usada pelo relatório Receita por Grupo; ainda não catalogada pelo `v_Dicionario_Dados` atual |

## 3. Evidência física e semântica

Usamos três estados de confiança:

- `DICTIONARY_CONFIRMED`: tabela/campo/FK confirmado no `v_Dicionario_Dados`.
- `ERP_LOG_CONFIRMED`: comportamento/JOIN/fórmula observado no SQL executado pelo próprio Sisloc.
- `SEMANTIC_PENDING`: objeto físico confirmado, mas interpretação de negócio ainda não validada o suficiente para virar regra global.

| Campo / regra | Evidência | Regra do contrato |
|---|---|---|
| `nf.dt_emi_nf` | `DICTIONARY_CONFIRMED` | Data física de emissão da tabela `nf` |
| `v_nf_emissao.dt_emissao` | `ERP_LOG_CONFIRMED` | Data usada no relatório Receita por Grupo quando `tipo_periodo=1`; não confundir com `nf.dt_emi_nf` |
| `nf.vl_faturamento` | `DICTIONARY_CONFIRMED` | Valor faturamento sintético da NF; não equivale por si só a Receita por Grupo |
| `nffatur.vl_nffatur` | `DICTIONARY_CONFIRMED + ERP_LOG_CONFIRMED` | Valor líquido utilizado nas fórmulas de rateio observadas no relatório Receita por Grupo |
| `nffatur.vl_bruto` | `DICTIONARY_CONFIRMED` | Campo diferente de `vl_nffatur`; não substituir automaticamente nas fórmulas do ERP |
| `grupo.nm_grupo` | `DICTIONARY_CONFIRMED + ERP_LOG_CONFIRMED` | Nome físico correto do grupo; `grupo.nome_grupo` é inválido para este schema |
| `nf.cd_pessoa_fun` | `DICTIONARY_CONFIRMED`, semântica conflitante | Caption do ERP indica vendedor e o relatório usa como dimensão pessoa/funcionário; manter `SEMANTIC_PENDING` até reconciliação específica |
| `financas_car_comissao.cd_pessoa` | `DICTIONARY_CONFIRMED` | Pessoa comissionada; não declarar globalmente como única definição de vendedor sem contexto do KPI |
| `fl_remessa.dt_saida` | `DICTIONARY_CONFIRMED` | Data operacional de saída; pode representar ativação física quando o KPI exigir esse evento |
| `cd_empresa` | `DICTIONARY_CONFIRMED + BUSINESS_APPROVED` | Empresas 5 (LLK RENTAL) e 6 (JCK) ficam fora do escopo analítico: estão inativas e não recebem novos cadastros, contratos ou lançamentos. A exclusão deve aparecer na linhagem/reconciliação, nunca ser silenciosa |

## 4. Contratos de consulta (obrigatórios)
1. **Nomes físicos literais:** toda SQL deve usar nomes confirmados no catálogo ou observados em log. É proibido inventar aliases físicos como `nf.dt_emissao` ou `grupo.nome_grupo`.
2. **Objetos distintos permanecem distintos:** `nf.dt_emi_nf` e `v_nf_emissao.dt_emissao` não são intercambiáveis sem reconciliação; `nffatur.vl_bruto` e `nffatur.vl_nffatur` também não.
3. **Datas sargáveis:** comparação por faixa `>= início AND < fim_exclusivo`. Para uma data final inclusiva informada pelo usuário, calcular `fim_exclusivo = data_final + 1 dia` apenas uma vez na camada de contexto.
4. **Relatório benchmark prevalece no seu domínio:** ao reconciliar um relatório do Sisloc, reproduzir as mesmas tabelas/views, JOINs, filtros, parâmetros e componentes observados no log antes de propor simplificações.
5. **Execução serial:** nenhuma consulta investigativa em paralelo (instabilidade do pool).
6. **Sem `LIKE` curinga** em metadados de sistema.
7. **Somente `SELECT`/`WITH`**, um único comando, validado pelo `SqlGuard` e auditado em `ErpQueryAudit`.
8. **Limite de linhas** em consultas de detalhe; agregações de reconciliação podem percorrer o universo completo quando necessárias.

## 5. Contrato observado — relatório Receita por Grupo

Captura realizada em 25/08/2026 para o período visual 01/01/2026 a 25/08/2026:

- `tipo_periodo=1`.
- SQL recebe `dtini=01/01/2026` e `dtfim=26/08/2026`.
- Regra temporal observada: `v_nf_emissao.dt_emissao >= :dtini AND v_nf_emissao.dt_emissao < :dtfim`.
- O relatório consulta múltiplas famílias de fato, incluindo locação por equipamento, composição, patrimônio/medidor, apontamentos, venda, OM, serviços e indenizações.
- A atribuição a grupo passa por `equipto.cd_grupo`, `composicao.cd_grupo` ou `servico.cd_grupo`, conforme o componente.
- O valor de rateio observado usa `nffatur.vl_nffatur` em conjunto com a participação do componente sobre `nf.vl_faturamento`.
- O universo técnico de empresas do benchmark deve ser lido do próprio parâmetro/SQL do relatório. No Cérebro aplica-se depois a regra de negócio explícita que exclui 5 (LLK RENTAL) e 6 (JCK), ambas inativas; em períodos históricos com movimentos antigos, a diferença deve ser classificada como divergência de escopo aprovada, não erro de cálculo.

Objetos físicos observados/confirmados para esse relatório: `fl_fatura`, `fl_fat_equ`, `fl_fat_comp`, `fl_fat_medidor`, `fl_apontamento_fatura`, `loc_fichloc_apont_apontamento`, `nf`, `nffatur`, `fich_loc`, `equipto`, `grupo`, `composicao`, `patrimon`, `ped_ven`, `pev_xequ`, `orcos`, `fichloc_servico`, `servico`, `fl_devolucao`, `fl_dev_equ`, `fl_rem_equ` e a view `v_nf_emissao`.

## 6. Divergências conhecidas (não resolvidas)
- `v_nf_emissao` é usada pelo ERP mas não está presente no catálogo atual derivado do `v_Dicionario_Dados`; precisamos ampliar a descoberta de views ou manter registro explícito de objetos observados em log.
- Receita por Grupo não é igual a `SUM(nf.vl_faturamento)` nem a `SUM(fl_fatura.vl_fatura)`.
- A implementação atual `receitaSislocRateio` ainda não reproduz todos os componentes e utiliza campos/fórmulas que divergem do log; deve ser substituída por reprodução fiel antes de virar benchmark.
- Papel semântico de `nf.cd_pessoa_fun` permanece pendente.
- Mapa oficial de empresas/filiais ainda precisa ser versionado; a exclusão das empresas 5 e 6 já está aprovada e documentada por inatividade operacional.
- Ausência de resolução de identidade canônica entre múltiplas fontes.

## 7. Perguntas abertas para os donos de negócio
1. Qual métrica deve receber o rótulo corporativo **Receita**: Faturamento NF, Receita por Grupo Sisloc, pré-faturamento ou outra visão? As demais devem manter nomes próprios.
2. Mapa oficial `cd_empresa` → filial/unidade e quais empresas pertencem a cada relatório/KPI.
3. Qual papel de negócio deve ser atribuído a `nf.cd_pessoa_fun` em cada domínio, considerando caption e comportamento do ERP.
4. Regra de vendedor/comissionado quando há mais de uma pessoa associada ao mesmo documento.

## 8. Critério de aceite do onboarding
- [ ] Perguntas da seção 7 respondidas e registradas em ADR
- [ ] Métrica de Receita registrada no Metric Registry com dono e versão
- [ ] Mapeamento Branch publicado
- [ ] Reconciliação ERP × plataforma dentro de tolerância acordada