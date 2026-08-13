# 07 — SOURCE SEMANTIC MODEL · Lokan ERP (Sisloc)

Versão 0.1 · 2026-08-13 · Status: PROPOSTA (nenhum mapping aprovado)
Base de evidência: SQL existente no Cérebro, `v_Dicionario_Dados`, comportamento observado em produção e conhecimento registrado no histórico do projeto. **Legado é evidência, não definição oficial.**

## Três camadas (nunca confundir)
```
Physical:        nf.vl_faturamento
Source Semantic: valor sintético de faturamento da NF no ERP Lokan
Canonical:       Invoice.gross_amount   ← ainda NÃO mapeado (não reconciliado)
Metric:          Revenue                ← bloqueada
```

## SourceSemanticContract (rascunho)
```yaml
source:
  id: SRC-MATRIZ
  name: Lokan ERP (Sisloc)
  engine: sqlserver
  version: 1
  contract_status: proposed

entities:
  party:
    source_table: pessoa
    primary_key: cd_pessoa
    roles:
      customer: fl_cliente_pessoa
      supplier: fl_fornec_pessoa
      employee: fl_funcion_pessoa
    confidence: 0.95
    notes: "FL_GENERALIZACAO não existe nesta versão; papéis vêm dos flags"

  rental_contract:
    source_table: fich_loc
    primary_key: cd_controle
    confidence: 0.93
    ambiguities:
      - "ficha pode existir sem locação efetiva"

  rental_dispatch:
    source_table: fl_remessa
    primary_key: cd_flremessa
    confidence: 0.9
    ambiguities:
      - "dt_liberacao nula em produção; dt_saida usada como proxy de ativação"

  invoice:
    source_table: nf
    primary_key: cd_nf
    confidence: 0.95

  receivable:
    source_table: car
    confidence: 0.85
  payable:
    source_table: cap
    confidence: 0.85
  commission:
    source_table: financas_car_comissao
    confidence: 0.8

relationships:
  invoice.customer:
    source: nf.cd_pessoa
    target: pessoa.cd_pessoa
    foreign_key_declared: unknown
    evidence: [dictionary, naming, usage]
    confidence: 0.95
  rental_contract.customer:
    source: fich_loc.cd_pessoa
    target: pessoa.cd_pessoa
    confidence: 0.93
  invoice.seller:
    via: financas_car_comissao
    rejected_alternative: nf.cd_pessoa_fun
    rejection_reason: "identifica apenas o emissor de back-office, não o vendedor"
    confidence: 0.75
```

## Campos com maturidade declarada
| Campo físico | Source semantic | DISCOVERED | UNDERSTOOD | TRUSTED | Bloqueio |
|---|---|---|---|---|---|
| `nf.vl_faturamento` | valor sintético de faturamento | ✅ | ✅ | ❌ | divergente dos relatórios "Total" e "Receita por Grupo"; impostos/frete/devolução indefinidos |
| `nf.cd_pessoa_fun` | funcionário emissor | ✅ | ✅ | ✅ (como emissor) | não usar como vendedor |
| `fl_remessa.dt_liberacao` | liberação da remessa | ✅ | ✅ | ❌ | nula em produção |
| `fl_remessa.dt_saida` | saída física | ✅ | ✅ | proxy | precisa decisão de negócio |
| `pessoa.dt_cad_pessoa` | data de cadastro | ✅ | ✅ | ✅ | não confundir com "novo cliente" |
| `pessoa.fl_ativo` | flag de atividade no ERP | ✅ | parcial | ❌ | semântica do bloqueio por inadimplência |
| `mkt_orcamento` | orçamentos | ✅ | ❌ | ❌ | tabela inacessível/vazia |
| `empresa.cd_empresa` | empresa/filial | ✅ | parcial | ❌ | divergência entre UI do ERP e dados brutos para "empresa 001" |

## Perguntas que exigem validação do negócio
1. Qual campo/relatório é a fonte da verdade de receita?
2. Qual evento ativa a locação: ficha, remessa liberada ou saída física?
3. Como devoluções, cancelamentos e estornos aparecem nas tabelas de NF e CAR?
4. Qual o mapeamento oficial de `cd_empresa` para empresas jurídicas e filiais?
5. Qual a regra oficial de atribuição de vendedor por NF?