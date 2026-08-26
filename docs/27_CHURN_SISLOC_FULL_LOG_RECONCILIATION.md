# 27 — CHURN SISLOC · FULL LOG RECONCILIATION

Versão 4.0-candidate · 2026-08-26 · Owner de negócio: Comercial / Growth Marketing
Status: **ESPECIFICAÇÃO PARA RECONCILIAÇÃO — NÃO TRUSTED**

## 1. Objetivo

Reconstruir o churn de locação a partir do comportamento operacional real do SISLOC, sem confundir:

1. estado da ficha de locação;
2. equipamento ainda em campo / processo de devolução;
3. faturamento recorrente da ficha;
4. encerramento real do relacionamento;
5. inatividade comercial após o fim da locação;
6. taxa de churn de um período versus estoque atual de clientes já churnados.

A meta de homologação é **zero divergência não explicada** entre SISLOC e Cérebro. Até isso ocorrer, nenhuma métrica de churn pode ser marcada como TRUSTED.

---

## 2. Evidência do full log analisado

Log de 26/08/2026, ficha `cd_controle=676399`, cliente `cd_pessoa=13442`, empresa 4.

### 2.1 A ficha é a unidade operacional

O SISLOC abre a entidade `TFichLocCrudEntity` e carrega `fich_loc` diretamente por `cd_controle`.

### 2.2 O SISLOC não reduz o estado da ficha a `dt_enc_ficha`

Além de ler `fich_loc.dt_enc_ficha`, o fluxo consulta repetidamente:

- quantidade remetida e quantidade devolvida por item;
- remessa cancelada;
- remessa ainda não expedida / em andamento;
- devolução pendente;
- entrada física da devolução;
- devolução cancelada;
- faturamentos e NFs ligados à ficha.

Consulta estrutural observada:

```sql
select coalesce(min(x.dt_encerramento),0) d1
from fl_rem_equ req
join fl_remessa x on x.cd_flremessa = req.cd_flremessa
where x.cd_controle = :cd_controle
  and req.qt_devolucao < req.qt_remessa
  and fl_rem_cancelada = 'N'
```

A condição `qt_devolucao < qt_remessa` demonstra que o SISLOC acompanha explicitamente **saldo físico ainda não devolvido**.

### 2.3 Remessas pré-operacionais são estados separados

A tela calcula:

```sql
-- Remessa aprovada mas ainda não expedida
count(*) where dt_pedido is not null and dt_saida is null

-- Remessa ainda em andamento e não cancelada
count(*) where (dt_pedido is null or dt_saida is null)
           and fl_rem_cancelada = 'N'
```

Portanto, uma ficha criada sem saída física não deve automaticamente contar como cliente operacionalmente ativo.

### 2.4 Devolução tem pedido, devolução e entrada física como eventos distintos

O SISLOC procura devoluções pendentes com:

```sql
from fl_devolucao d
join fich_loc f on f.cd_controle = d.cd_controle
where d.cd_controle = :cd_controle
  and (d.dt_pedido is null or d.dt_entrada is null)
  and d.fl_operacao = 'D'
  and d.fl_dev_cancelada <> 'S'
```

E, no `TSetFichaLocacaoProcess`, só carrega como devolução efetivada as linhas com:

```sql
D.dt_entrada is not null
```

Conclusão: `dt_devolucao` e `dt_entrada` não são sinônimos. Para retorno físico efetivado, `dt_entrada` é evidência mais forte.

### 2.5 Faturamento recorrente ocorre dentro da mesma ficha

O `TSetFichaLocacaoProcess` carrega os faturamentos da ficha por:

```sql
select cd_flfatura, cd_nf, dt_inicio, dt_fim, fatura_complementar
from fl_fatura
where cd_controle = :cd_controle
  and cd_flfatura <> 0
  and cd_nf is not null
union
select cd_flfatura, cd_nf_mo, dt_inicio, dt_fim, fatura_complementar
from fl_fatura
where cd_controle = :cd_controle
  and cd_flfatura <> 0
  and cd_nf_mo is not null
```

Na ficha analisada, o processo encontrou **26 faturamentos/NFs**.

A visualização do último faturamento mostra:

- `dt_geracao = 11/08/2026`;
- período `06/08/2026 → 04/09/2026`;
- `vl_fatura = 654`;
- `cd_nf = 247126`;
- `calcfat = 30 Dias`;
- faturamento anterior em `10/07/2026`.

A linha do tempo retornada pelo processo contém uma remessa inicial e faturas sucessivas de 2024 a 2026. Isso confirma o modelo de renovação periódica na mesma ficha.

### 2.6 A NF da locação deve nascer de `fl_fatura`

O processo parte de `fl_fatura.cd_nf` / `fl_fatura.cd_nf_mo` e, para cada documento, lê:

```sql
isnull(nf.dt_emi_nf, v_nf_emissao.dt_emissao) as dt_emi_nf
```

Logo, para churn de locação, a cadeia primária é:

`fich_loc -> fl_fatura -> nf`

O universo fiscal genérico do Cérebro não pode eliminar uma cobrança válida de locação sem reconciliação explícita.

### 2.7 `fl_baixada` não apareceu no full log

Não existe evidência neste log para usar `fich_loc.fl_baixada` como definidor de contrato aberto/encerrado. Deve continuar fora da regra dura até haver evidência específica.

### 2.8 O retorno `dt_enc_ficha=true` do processo não é uma data

`TSetFichaLocacaoProcess` recebe `dt_enc_ficha` vazio, consulta o campo persistido da ficha e devolve um parâmetro booleano `dt_enc_ficha=true` no envelope. Esse booleano **não pode ser tratado como o valor datetime de `fich_loc.dt_enc_ficha`**. O campo persistido continua sendo o datetime `fich_loc.dt_enc_ficha` (`Encerrado em`).

---

## 3. Divergências encontradas no motor v3 atual

Arquivo: `base44/functions/analyzeClientChurn/entry.ts`.

### D1 — ficha aberta efetiva simplificada demais

Hoje:

```sql
f.dt_enc_ficha IS NULL
AND (last_remessa IS NOT NULL OR last_nf IS NOT NULL)
```

Problema: uma ficha que ficou sem `dt_enc_ficha` por inconsistência pode permanecer ativa indefinidamente, mesmo após devolver tudo.

A regra precisa avaliar saldo físico, devolução pendente e faturamento atual.

### D2 — relógio de churn usa apenas a última NF

Hoje, depois que não existe ficha aberta, o envelhecimento usa `last_rental_nf`.

Isso pode antecipar falsamente o churn quando:

- a última NF foi emitida antes da devolução;
- o período faturado termina depois da emissão;
- a ficha é encerrada depois da última NF.

O relógio de inatividade não pode começar antes do fim real da relação comercial.

### D3 — universo fiscal genérico pode não ser idêntico ao universo de faturamento de locação

A versão atual aplica `invoiceUniverse`, que exige `fl_ent_sai='S'`.

O full log do processo da ficha não usa esse filtro para montar os faturamentos: ele parte dos documentos vinculados em `fl_fatura` e lê o estado da NF depois.

A aderência do `invoiceUniverse` às notas de débito/serviço de locação precisa ser reconciliada. Até lá, ele não pode ser assumido como verdade universal do churn.

### D4 — taxa de churn atual mede estoque/prevalência, não incidência do período

Hoje:

```text
churn_rate = churned_clients / eligible_clients
```

Isso mistura clientes que já estavam churnados com clientes que se tornaram churn no período.

A versão v4 separa:

- `churn_snapshot`: quantos estão churnados na data de referência;
- `new_churn_events`: quantos cruzaram o limiar de 13 meses dentro do período;
- `period_churn_rate`: novos churns / base elegível no início do período.

### D5 — coorte e estado atual estão misturados

O motor atual começa por clientes com evento em uma janela histórica (`ref_clients`).

Para Customer Health e carteira atual, a população correta é **todos os clientes historicamente ativados**, classificados na data de corte. A coorte deve existir apenas para métricas de retenção/churn por período.

---

## 4. Modelo v4 — duas máquinas de estado

Para evitar misturar contrato com comportamento, o Cérebro deve manter duas classificações independentes.

### 4.1 Estado operacional da ficha

Grão: `cd_controle`.

Campos/evidências principais:

- `fich_loc.dt_enc_ficha` — encerramento persistido;
- `fl_remessa.dt_saida` — saída física;
- `fl_remessa.fl_rem_cancelada` — cancelamento de remessa;
- `fl_rem_equ.qt_remessa` / `qt_devolucao` — saldo físico;
- `fl_devolucao.dt_pedido` — pedido de devolução;
- `fl_devolucao.dt_entrada` — retorno físico efetivado;
- `fl_devolucao.fl_dev_cancelada` — cancelamento de devolução;
- `fl_fatura.dt_inicio`, `dt_fim`, `dt_geracao`, `cd_nf`, `cd_nf_mo` — cobertura/faturamento;
- `fich_loc.dt_fat_ficha` — próxima geração;
- `fich_loc.dt_suspensao` — faturamento suspenso até.

Estados candidatos:

| Estado | Regra operacional | Efeito no churn |
|---|---|---|
| `NAO_ATIVADA` | sem remessa expedida e sem faturamento válido | fora da base de clientes de locação |
| `PRE_OPERACIONAL` | remessa não cancelada em andamento, sem saída | não prova relação ativa; acompanhar separadamente |
| `ATIVA_EM_CAMPO` | `dt_enc_ficha IS NULL` + saldo físico `qt_remessa - qt_devolucao > 0` em remessa não cancelada | bloqueia churn |
| `DEVOLUCAO_EM_ANDAMENTO` | devolução D não cancelada com pedido/entrada pendente | bloqueia churn |
| `ATIVA_FATURAMENTO` | ficha não encerrada + período faturado vigente / próxima geração coerente | bloqueia churn |
| `SUSPENSA` | ficha não encerrada + `dt_suspensao` vigente | bloqueia churn; alerta operacional |
| `ABERTA_SEM_SALDO` | `dt_enc_ficha IS NULL`, sem saldo, sem devolução pendente e sem cobertura/faturamento atual | auditoria; não declarar churn automaticamente |
| `ENCERRADA` | `dt_enc_ficha IS NOT NULL`, sem saldo físico e sem devolução pendente | elegível para relógio de inatividade |
| `ENCERRADA_INCONSISTENTE` | `dt_enc_ficha IS NOT NULL` mas ainda há saldo/devolução pendente | auditoria; não declarar churn automaticamente |

### 4.2 Estado comportamental do cliente

Grão: `cd_pessoa`.

Roll-up:

1. se qualquer ficha estiver `ATIVA_EM_CAMPO`, `DEVOLUCAO_EM_ANDAMENTO`, `ATIVA_FATURAMENTO` ou `SUSPENSA` → cliente `ATIVO_CONTRATO`;
2. se houver qualquer ficha em estado inconsistente → cliente `AUDITAR_ESTADO_OPERACIONAL`;
3. somente se todas as fichas ativadas estiverem `ENCERRADA` calcular recência;
4. cliente sem ficha historicamente ativada não entra na base de churn de locação.

---

## 5. Nova âncora temporal de inatividade

Para um cliente sem ficha operacionalmente ativa:

```text
relationship_end_date = MAX(
  ultima_dt_enc_ficha,
  ultima_dt_entrada_devolucao,
  ultimo_dt_fim_fatura,
  ultima_data_nf_locacao
)
```

Motivo:

- NF pode ser emitida antes do equipamento retornar;
- uma fatura pode cobrir dias após sua emissão;
- o contrato pode ser encerrado após a última NF.

Nunca iniciar o relógio de churn antes do fim real do relacionamento.

Se os quatro sinais divergirem materialmente, gerar evidência de auditoria em vez de resolver silenciosamente.

---

## 6. Regra dura v4-candidate

Padrão de negócio: **13 meses**.

```text
IF cliente_nunca_ativado
  => NAO_CLIENTE_LOCACAO
ELSE IF existe_ficha_operacionalmente_ativa
  => ATIVO_CONTRATO
ELSE IF existe_inconsistencia_operacional
  => AUDITAR_ESTADO_OPERACIONAL
ELSE IF relationship_end_date IS NULL
  => AUDITAR_SEM_DATA_FIM
ELSE IF relationship_end_date < as_of_date - 13 meses
  => CHURN_CONFIRMADO
ELSE
  => CLIENTE_SEM_CONTRATO_ATUAL, ainda dentro da janela de proteção
```

O faturamento recorrente continua sendo evidência econômica, mas **não substitui o estado operacional da ficha**.

---

## 7. Growth sobre a nova âncora

As faixas de Growth devem usar `days_since_relationship_end`, não `days_since_last_nf`.

- `ATIVO_CONTRATO` — alguma ficha operacionalmente ativa;
- `ENCERRADO_RECENTE` — contrato terminou recentemente;
- `MONITORAR` — ~50% da janela de 13 meses;
- `PRE_CHURN` — ~75% da janela;
- `CHURN_CONFIRMADO` — ultrapassou 13 meses;
- `AUDITAR_ESTADO_OPERACIONAL` — inconsistência de ficha/remessa/devolução;
- `AUDITAR_SEM_NF` / `AUDITAR_SEM_DATA_FIM` — falha de linhagem.

Faixas 50%/75% são heurísticas de Growth e não alteram a definição dura de churn.

---

## 8. Taxa de churn correta por período

### Snapshot

```text
churn_snapshot_count(as_of) = clientes cujo churn_date <= as_of
```

### Data de churn

```text
churn_date = relationship_end_date + 13 meses
```

### Novos churns no período

```text
new_churn_events = count(clientes com churn_date dentro do período)
```

### Base elegível no início

Clientes historicamente ativados que, no início do período:

- ainda não eram churn;
- não estavam em estado de auditoria;
- não eram apenas fichas nunca ativadas.

### Taxa

```text
period_churn_rate = new_churn_events / eligible_customers_at_period_start
```

Isso não deve ser confundido com a proporção de clientes atualmente churnados.

---

## 9. Universo de faturamento de locação a reconciliar

Candidato v4:

1. partir de `fl_fatura` vinculada à ficha;
2. usar `cd_nf` e `cd_nf_mo`;
3. buscar a emissão por `COALESCE(nf.dt_emi_nf, v_nf_emissao.dt_emissao)`;
4. excluir documentos comprovadamente cancelados/anulados;
5. verificar se `fl_ent_sai='S'` é realmente obrigatório para todos os tipos de cobrança de locação antes de reaproveitar o `invoiceUniverse` genérico.

A data de cobertura comercial (`fl_fatura.dt_fim`) deve ser mantida separada da data fiscal de emissão.

---

## 10. Reconciliação necessária para promover a TRUSTED

Amostra dirigida mínima:

1. ficha aberta, saldo em campo, NF recente;
2. ficha aberta, saldo em campo, NF atrasada;
3. ficha aberta e faturamento suspenso;
4. remessa aprovada mas ainda não expedida;
5. devolução parcial;
6. devolução total com entrada física registrada, ficha ainda sem `dt_enc_ficha`;
7. ficha encerrada corretamente;
8. ficha encerrada com saldo físico inconsistente;
9. todas fichas encerradas há menos de 13 meses;
10. todas fichas encerradas há mais de 13 meses;
11. última NF anterior ao encerramento da ficha;
12. faturamento cujo `dt_fim` é posterior à emissão da NF;
13. cliente anual/sazonal que retorna entre 12 e 13 meses;
14. cliente com várias fichas, sendo ao menos uma ativa;
15. cliente com remessa real e nenhum vínculo fiscal localizável;
16. ficha nunca ativada/orçamento abandonado.

Para cada cliente/ficha registrar:

- status exibido no SISLOC;
- `dt_enc_ficha`;
- quantidade remetida;
- quantidade devolvida;
- saldo físico;
- remessas pendentes/canceladas;
- devoluções pendentes/canceladas;
- última entrada física;
- todas as faturas e seus períodos;
- NFs válidas/canceladas;
- `relationship_end_date` calculada;
- status v3;
- status v4;
- divergência e motivo.

Critério de aceite:

```text
unexplained_divergences = 0
```

Somente então:

- substituir v3 por v4;
- promover MTR-010/MTR-011 para versão candidata a TRUSTED;
- alterar Reativação e Customer Health para usar v4;
- congelar a versão da regra com `as_of_date` explícito.

---

## 11. Implementação de reconciliação entregue

**O motor v3 continua preservado. A v4 foi implementada em paralelo e permanece NÃO TRUSTED.**

Entregues:

1. `base44/shared/rentalChurnV4.ts` — contrato executável da v4;
2. `base44/functions/reconcileRentalChurnV4/entry.ts` — reconciliação admin v3 × v4;
3. snapshot cliente a cliente com `relationship_end_date`, `churn_date`, estados operacionais e divergência explicada;
4. evidência ficha a ficha para as maiores divergências;
5. comparação entre NF vinculada válida e o universo fiscal canônico atual, sem resolver divergências silenciosamente;
6. painel manual **Homologação Churn v4 · SISLOC Full Log** dentro da aba de churn;
7. motor temporal de episódios para preservar churn histórico seguido de reativação.

### 11.1 Motor temporal de episódios

Para MTR-010, a v4 não usa apenas o último relacionamento. Cada ficha ativada gera um intervalo econômico-operacional. Fichas sobrepostas são unidas em um mesmo episódio por `cd_pessoa`.

Para cada episódio:

```text
candidate_churn_date = episode_end + N meses
```

O evento somente existe se:

```text
next_episode_start IS NULL
OR next_episode_start > candidate_churn_date
```

Assim, se um cliente fica 14 meses sem locar e depois retorna, o churn ocorrido no passado não desaparece do histórico por causa da reativação posterior.

A base elegível no início do período é reconstruída pelo último evento conhecido antes de `period_start`: cliente precisa ter sido ativado e não pode continuar churnado sem uma reativação posterior.

A taxa candidata é:

```text
period_churn_rate = clientes da base inicial que cruzaram churn_date no período
                    / clientes elegíveis no início do período
```

Clientes com inconsistência operacional atual são excluídos conservadoramente da taxa candidata e contabilizados à parte.

### 11.2 O que ainda bloqueia TRUSTED

A implementação executável não equivale à homologação.

Ainda é obrigatório:

1. executar `reconcileRentalChurnV4` contra o ERP;
2. validar a amostra dirigida da seção 10;
3. comprovar o universo fiscal correto de `cd_nf` e `cd_nf_mo`;
4. confirmar a precedência dos estados `ATIVA_EM_CAMPO`, `DEVOLUCAO_EM_ANDAMENTO`, `SUSPENSA`, `ATIVA_FATURAMENTO` e `ABERTA_SEM_SALDO`;
5. reconciliar `relationship_end_date` quando `dt_enc_ficha`, `dt_entrada`, `dt_fim` e emissão da NF divergem;
6. registrar manualmente o status exibido no SISLOC para os casos dirigidos;
7. atingir `unexplained_divergences = 0`.

Somente depois disso o v3 pode ser substituído e MTR-010/MTR-011 podem avançar de BLOQUEADA para candidata a TRUSTED.

---

## 12. Ground truth persistente no Cérebro

A homologação v4 deixa de depender de prints, planilhas ou cópia manual de resultados.

Foram criadas duas entidades administrativas:

- `ChurnV4ReconciliationRun` — snapshot de cada execução da reconciliação;
- `ChurnV4AuditCase` — matriz persistente dos casos dirigidos que precisam ser confrontados com o SISLOC.

Cada run registra, entre outros:

- fonte, corte e janela;
- versão da regra;
- cobertura populacional do v3;
- churn snapshot v4;
- divergências conhecidas;
- falso churn por contrato ativo;
- falso churn por âncora temporal;
- fichas abertas stale que exigem auditoria;
- divergência do universo fiscal;
- taxa candidata por episódios;
- número de clientes/eventos que cruzaram churn no período;
- quantidade de churns históricos seguidos de reativação;
- `unexplained_divergences`.

A execução de `reconcileRentalChurnV4` persiste automaticamente o run e até 100 casos dirigidos, sem promover nenhum resultado para TRUSTED.

### 12.1 Amostra dirigida automática

O motor tenta selecionar exemplos para:

1. caso do full log (`cd_pessoa=13442`, ficha de referência `676399`);
2. falso churn v3 com contrato ativo;
3. falso churn v3 por âncora temporal;
4. ficha aberta stale;
5. inconsistência operacional;
6. divergência de universo fiscal;
7. múltiplas fichas com ao menos uma ativa;
8. controle positivo de contrato ativo;
9. encerrado ainda protegido;
10. churn confirmado;
11. cliente ativado sem NF vinculada;
12. ficha nunca ativada;
13. cliente sazonal entre 12 e 13 meses.

A seleção depende da existência real de cada arquétipo na base; ausência de caso não gera dado artificial.

### 12.2 Veredito humano contra o SISLOC

Cada `ChurnV4AuditCase` começa como `pending` e recebe:

- `sisloc_observed_status` — o que o ERP efetivamente mostra;
- `verdict`:
  - `match` — v4 reproduz o SISLOC;
  - `explained` — divergência operacional/documental explicada e aceita;
  - `fail` — regra v4 diverge do SISLOC;
- justificativa;
- revisor e data de revisão.

O run permanece `reviewing` enquanto houver casos pendentes. Quando todos forem revisados:

- qualquer `fail` mantém o run bloqueado;
- zero `fail` torna o run apenas `candidate`, nunca `trusted` automaticamente.

### 12.3 Critério formal de promoção

Para considerar a regra apta a substituir v3, devem ser verdadeiras simultaneamente:

```text
pending_cases = 0
unexplained_divergences = 0
fiscal_universe_conclusion = documented
operational_state_precedence = documented
relationship_end_anchor = documented
business_owner_approval = explicit
```

Mesmo com todos os testes aprovados, `trusted=true` não é preenchido automaticamente. A promoção deve ser uma decisão de governança separada e rastreável.

### 12.4 Execução inicial

Ao abrir o painel de homologação:

1. o Cérebro tenta carregar o último run persistido da fonte;
2. se nenhum run existir, executa uma primeira reconciliação automaticamente;
3. novas execuções permanecem disponíveis pelo botão manual;
4. a carga automática não se repete quando já existe histórico persistido.
