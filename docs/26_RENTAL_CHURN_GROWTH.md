# 26 — CHURN DE LOCAÇÃO & GROWTH MARKETING

Versão 2.0-candidate · 2026-08-25 · Owner de negócio: Comercial / Growth Marketing

## 1. Problema corrigido

O churn legado tratava principalmente **nova remessa** como evidência de retenção. Isso não representa o modelo de locação da Lokan: um cliente pode assinar uma ficha de longa duração, permanecer meses com o equipamento e gerar faturamentos/movimentações recorrentes sem criar nova remessa ou novo contrato.

Consequência: contratos anuais com cobrança mensal podiam ser interpretados como perda de relacionamento, inflando churn e receita em risco.

## 2. Regra dura de churn

O padrão de negócio permanece **13 meses** para proteger clientes sazonais que locam uma vez ao ano, como manutenções de entressafra/usinas.

Um cliente só pode ser `CHURN_CONFIRMADO` quando, simultaneamente:

1. não existe contrato de locação vigente; e
2. não existe atividade válida de locação dentro dos últimos N meses (`N=13` por padrão).

Contrato vigente = alguma `fich_loc` do cliente com `fl_baixada <> 'S'` e `dt_enc_ficha IS NULL`.

## 3. O que é atividade válida

`last_activity` é a maior data entre evidências transacionais ligadas à locação:

- `fl_remessa.dt_saida` — equipamento efetivamente remetido;
- `fl_fatura.dt_geracao` — faturamento recorrente da ficha;
- `est_mov.dt_geracao` — movimento operacional/estoque ligado ao `cd_controle` da ficha;
- `fich_loc.dt_fau_ficha` — última geração de faturamento registrada na própria ficha.

`fich_loc.dt_mov` (data da última alteração cadastral) é exposta para auditoria, mas **não é usada isoladamente para evitar churn**, pois uma edição administrativa não prova atividade econômica.

## 4. Estados acionáveis de Growth

A regra de churn é binária, mas Growth precisa agir antes da perda. A versão 2 cria estados operacionais sobre a janela de 13 meses:

| Estado | Regra | Ação sugerida |
|---|---|---|
| `ATIVO_CONTRATO` | há contrato vigente | expansão, cross-sell e monitoramento de renovação |
| `ATIVO_RECENTE` | sem contrato aberto, recência < 50% da janela | relacionamento normal |
| `MONITORAR` | recência entre 50% e 75% da janela | nutrição e sinais de nova demanda |
| `PRE_CHURN` | recência entre 75% e 100% da janela | campanha/SDR de reativação prioritária |
| `CHURN_CONFIRMADO` | sem contrato vigente e sem atividade por mais de N meses | win-back / reativação |

Com N=13 meses, as faixas intermediárias são apenas gatilhos de Growth; **não alteram o hard churn de 13 meses**.

## 5. Periodicidade da locação não é duração do contrato

Há duas dimensões independentes no SISLOC:

### 5.1 Ciclo de faturamento

Fonte: `fich_loc.cd_calcfat -> calcfat`.

Campos físicos confirmados no dicionário:
- `calcfat.ds_calcfat` — descrição do período de locação;
- `calcfat.num_dias_periodo` — número de dias do período;
- `fich_loc.nr_periodos` — períodos a faturar;
- `fich_loc.dt_fau_ficha` — última geração;
- `fich_loc.dt_fat_ficha` — próxima geração.

Bucket técnico inicial por `num_dias_periodo`:
- 1–2: diária;
- 3–8: semanal;
- 9–16: quinzenal;
- 17–35: mensal;
- 36–100: ciclo longo;
- 101–299: multimensal;
- 300+: anual.

A descrição original `ds_calcfat` sempre é preservada para auditoria e futura homologação com o Comercial.

### 5.2 Horizonte total do contrato

Estimado prioritariamente por:

`DATEDIFF(dt_fai_ficha, COALESCE(dt_prevista_devolucao, dt_faf_ficha, dt_enc_ficha))`

Quando não existe data final utilizável:

`nr_periodos * calcfat.num_dias_periodo`

Buckets:
- até 2 dias;
- 3–8 dias;
- 9–16 dias;
- 17–45 dias;
- 46–180 dias;
- 181–300 dias;
- 301 dias ou mais.

Portanto um contrato pode ser simultaneamente:

**Horizonte: 301+ dias / anual** + **Ciclo de faturamento: mensal**.

Esse é o caso que a modelagem anterior não conseguia representar corretamente.

## 6. KPIs de qualidade do churn

A função `analyzeClientChurn` passa a devolver, além da taxa final:

- `retained_by_contract` — clientes preservados porque possuem contrato vigente;
- `retained_by_activity` — preservados por atividade válida recente;
- `prevented_false_churn` — clientes sem nova remessa que seriam candidatos ao churn antigo, mas possuem contrato/faturamento/movimento válido;
- `seasonal_protected_clients` — clientes entre aproximadamente 12 e 13 meses de recência ainda protegidos pela regra sazonal;
- `long_contract_active_clients` — ativos com horizonte de 301 dias ou mais;
- `monthly_open_contract_clients` — contrato vigente com ciclo de faturamento mensal.

A interface segmenta a base por:
- status de Growth;
- ciclo de faturamento;
- horizonte do contrato.

## 7. Próxima evolução: cadência individual do cliente

O hard churn continuará em 13 meses. Porém `MONITORAR` e `PRE_CHURN` devem evoluir de faixas genéricas para uma expectativa individual baseada na recorrência histórica de cada cliente.

Candidato v2.1:

1. calcular gaps entre remessas/contratos do cliente via `LAG(dt_saida)`;
2. estimar mediana de dias entre locações;
3. comparar `dias_desde_ultima_atividade / cadencia_historica`;
4. acelerar o alerta para clientes normalmente semanais/mensais;
5. manter tolerância ampla para sazonais anuais;
6. nunca promover cliente com contrato vigente para churn.

Isso separa **churn confirmado** de **risco comportamental**, permitindo que Growth trabalhe antes dos 13 meses sem distorcer o KPI oficial.
