# 26 — CHURN DE LOCAÇÃO & GROWTH MARKETING

Versão 3.0-candidate · 2026-08-25 · Owner de negócio: Comercial / Growth Marketing

## 1. Princípio central

O churn da Lokan deve respeitar a unidade operacional real do SISLOC: a **ficha de locação**.

A hierarquia oficial é:

1. verificar se o cliente possui alguma ficha de locação efetivamente aberta;
2. se todas as fichas efetivas estiverem encerradas, localizar a última NF válida vinculada à locação;
3. somente então aplicar a janela de inatividade, com padrão de 13 meses.

Em forma curta:

**ficha aberta primeiro → última NF válida depois → 13 meses por último**.

## 2. Evidência extraída do log SISLOC

O fluxo real `TSetFichaLocacaoProcess` consulta explicitamente `fich_loc.dt_enc_ficha` para a ficha e, separadamente, carrega:

- remessas realizadas em `fl_remessa` (`dt_saida is not null`);
- devoluções efetivadas em `fl_devolucao` (`dt_entrada is not null`);
- faturamentos da ficha em `fl_fatura`, incluindo vínculos por `cd_nf` e `cd_nf_mo`;
- dados da NF em `nf` / `v_nf_emissao`.

No log homologado da ficha `cd_controle=826207`, uma mesma ficha possui múltiplas NFs/faturamentos ao longo do tempo. Isso confirma que uma locação de longa duração pode permanecer na mesma ficha enquanto renova cobrança periodicamente.

Também foi observada devolução vinculada à mesma ficha. Portanto, **uma devolução isolada não é suficiente para declarar o contrato encerrado**; ela é um evento interno da ficha. O estado da ficha continua sendo a evidência decisória.

## 3. O que é uma ficha aberta para o churn

A evidência principal de encerramento é:

`fich_loc.dt_enc_ficha`

Regra candidata:

- `dt_enc_ficha IS NULL` = ficha não encerrada;
- `dt_enc_ficha IS NOT NULL` = ficha encerrada.

Por segurança, uma ficha aberta somente protege o cliente do churn quando existir evidência de locação real:

- remessa efetivamente realizada (`fl_remessa.dt_saida IS NOT NULL` e não cancelada); ou
- NF válida vinculada à ficha por `fl_fatura`.

Isso evita que orçamento/ficha abandonada sem operação real mantenha um cliente artificialmente ativo.

`fl_baixada` não participa mais da regra principal desta versão. O log homologado mostrou `dt_enc_ficha` sendo lido diretamente pelo processo da ficha; `fl_baixada` permanece como campo complementar até existir evidência de comportamento equivalente no ERP.

## 4. NF válida de locação

Quando não existe ficha efetivamente aberta, a recência oficial do relacionamento passa a ser a **última NF válida de locação**.

A NF precisa estar ligada à ficha pela cadeia:

`fich_loc.cd_controle -> fl_fatura.cd_controle -> fl_fatura.cd_nf/cd_nf_mo -> nf.cd_nf`

A data usada é:

`COALESCE(nf.dt_emi_nf, v_nf_emissao.dt_emissao)`

O universo fiscal continua respeitando o contrato canônico de NF do Cérebro (`invoiceUniverse`).

Remessas, devoluções, `est_mov`, `dt_mov` e `dt_fau_ficha` podem ser exibidos para auditoria operacional, mas **não renovam sozinhos o relógio de churn quando todas as fichas estão encerradas**.

## 5. Regra dura de churn

Padrão: **13 meses**.

Um cliente é `CHURN_CONFIRMADO` somente quando:

1. pertence à base histórica de clientes efetivamente atendidos;
2. não possui nenhuma ficha efetivamente aberta;
3. possui NF válida de locação conhecida;
4. a última NF válida de locação está anterior ao cutoff de N meses (`N=13` por padrão).

Formalmente:

`CHURN = sem_ficha_aberta AND ultima_nf_locacao < cutoff_13m`

## 6. Exceção de qualidade: locação sem NF válida

Se o cliente possui evidência de locação real, não tem ficha aberta, mas nenhuma NF válida de locação é encontrada na janela histórica disponível, ele **não é forçado para churn**.

Status:

`AUDITAR_SEM_NF`

Esses clientes ficam fora do denominador da taxa oficial até a inconsistência ser explicada.

Isso evita transformar falha de vínculo fiscal/dado incompleto em perda comercial.

## 7. Estados de Growth

| Estado | Regra | Uso |
|---|---|---|
| `ATIVO_CONTRATO` | existe ficha efetivamente aberta e faturamento dentro da tolerância | expansão, cross-sell, renovação |
| `ATIVO_CONTRATO_ALERTA` | ficha aberta, porém última NF está fora da cadência/tolerância técnica | investigar faturamento/contrato |
| `ATIVO_RECENTE` | sem ficha aberta; última NF ainda recente | relacionamento normal |
| `MONITORAR` | sem ficha aberta; recência passou ~50% da janela | nutrição / acompanhamento |
| `PRE_CHURN` | sem ficha aberta; recência passou ~75% da janela | reativação prioritária |
| `CHURN_CONFIRMADO` | sem ficha aberta e última NF além de 13 meses | win-back |
| `AUDITAR_SEM_NF` | locação efetiva sem NF válida localizável | saneamento de dados |

As faixas de 50% e 75% são gatilhos de Growth, não redefinem o hard churn.

## 8. Alerta de faturamento em ficha aberta

Ficha aberta nunca vira churn nesta regra.

Porém o Cérebro pode sinalizar anomalia quando a ficha está aberta e a última NF associada está atrasada em relação ao ciclo esperado.

Heurística inicial desta versão:

`tolerância = max(45 dias, 2 × calcfat.num_dias_periodo)`

Quando não existe ciclo válido, a tolerância técnica padrão é 90 dias.

Esse alerta é operacional e precisa de homologação futura; ele não altera o status de churn.

## 9. Periodicidade da locação

A periodicidade continua sendo analisada separadamente do churn.

Fonte:

`fich_loc.cd_calcfat -> calcfat`

Campos:

- `calcfat.ds_calcfat` — descrição do ciclo;
- `calcfat.num_dias_periodo` — dias por período;
- `fich_loc.nr_periodos` — quantidade de períodos;
- `fich_loc.dt_fat_ficha` — próxima geração;
- `fich_loc.dt_fau_ficha` — última geração registrada na ficha.

Um contrato pode ser anual no horizonte e mensal no faturamento. Isso não muda a regra dura: enquanto houver ficha efetivamente aberta, o cliente está ativo.

## 10. KPIs da versão 3

- `eligible_clients` — clientes que podem entrar no denominador do churn;
- `audit_without_nf` — exceções sem NF válida;
- `retained_by_contract` — protegidos por ficha efetivamente aberta;
- `retained_by_activity` — sem ficha aberta, mas com NF recente;
- `prevented_false_churn` — clientes que ultrapassariam a janela por NF, porém permanecem ativos por ficha aberta;
- `open_contract_billing_alerts` — fichas abertas com possível atraso/anomalia de faturamento;
- `churned_clients` — churn confirmado;
- `churn_rate` — `churned_clients / eligible_clients`;
- `revenue_at_risk` — receita histórica da base que pertence aos churns confirmados.

## 11. Próxima homologação recomendada

Para fechar o contrato semântico como definitivo, executar amostragem dirigida no ERP:

1. cliente com ficha aberta e NF mensal recente;
2. cliente com ficha aberta e NF atrasada;
3. cliente com devolução parcial e ficha aberta;
4. cliente com todas as fichas encerradas e NF há menos de 13 meses;
5. cliente com todas as fichas encerradas e NF há mais de 13 meses;
6. cliente com remessa real mas sem NF encontrada.

Para cada caso, comparar o status exibido no SISLOC, `dt_enc_ficha`, remessas, devoluções, `fl_fatura` e NFs.

A meta de homologação é **zero divergência não explicada entre o status do cliente no Cérebro e a evidência operacional/fiscal do SISLOC**.
