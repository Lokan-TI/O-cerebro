# 09 — IDENTITY RESOLUTION & MASTER DATA MANAGEMENT

Versão 1.0-draft · 2026-08-13

## Princípio
IDs de origem nunca são identidade. O Cérebro emite IDs canônicos próprios: `CUS-000018293`, `AST-…`, `SUP-…`.

## Crosswalk
```
canonical_entity_id · source_system_id · source_entity · source_record_id
· identifier_type · identifier_value · match_method · match_confidence · approved · reviewed_by · reviewed_at
```
Exemplo: `CUS-000018293` ← ERP Bauru `pessoa 1234` + ERP Londrina `pessoa 8291` + CRM `contact 987` + RD Station `lead ABC`.

## Níveis de matching
**Determinístico** — CNPJ, CPF, identificador fiscal, e-mail corporativo idêntico → confidence 1.0, auto-aprovado.
**Probabilístico** — nome/razão social, telefone, cidade, endereço, domínio de e-mail, similaridade textual → 0.6–0.95, requer revisão acima do limiar e abaixo de 0.95.
**Manual** — abaixo do limiar; fila de revisão com decisão registrada.

## Regras
1. **Proibido** somar clientes de mais de uma fonte antes de resolution (hoje `mergeSnapshots.js` consolida sem isso — risco de dupla contagem).
2. CPF/CNPJ devem ser normalizados (só dígitos) e validados antes do match; a máscara é apresentação.
3. Documento inválido/ausente não gera merge probabilístico automático.
4. Merge é reversível: guarda-se o histórico de merges e splits.
5. Contagem de clientes exibida ao executivo declara se é canônica ou por fonte.

## Métricas de qualidade da identidade
`duplicate_rate por fonte · cross-source overlap · % registros sem documento válido · % merges pendentes de revisão · mapping coverage`.

## Estado atual
Matching **determinístico** implementado (`resolvePartyIdentity`, aba admin "Identidade (Party)"): documento normalizado (CNPJ com prioridade sobre CPF, apenas dígitos, comprimento 11 ou 14). Probabilístico e fila de merge revisável ainda não implementados. Consolidação multi-fonte continua exibida como "soma por fonte (pode conter duplicidade)" — a resolution roda por fonte, não entre fontes.

### Execução de referência — Lokan/Matriz (2026-08-13, `PRR-20260813212118`)
| Medida | Valor |
|---|---|
| Registros em `pessoa` | 20.413 |
| Party canônicos (docs distintos + sem documento) | 19.560 |
| Cobertura de documento válido | 96,2% (785 sem CNPJ/CPF válido) |
| Grupos duplicados por documento | 67 · 136 registros (0,67%) |
| PartyRole | Customer 19.549 · Supplier 1.541 · Employee 197 · multi-papel 1.171 · sem papel 316 |

**Reconciliação canônico × legado (clientes):** 19.019 canônicos vs. 19.549 registros com papel de cliente → **−530 (−2,71%)**. A contagem legada por registro superestima clientes; nenhuma tela executiva deve exibir contagem canônica como oficial antes de aprovação do owner.

Registros sem documento válido permanecem como Party isolado (regra 3: proibido merge probabilístico automático).