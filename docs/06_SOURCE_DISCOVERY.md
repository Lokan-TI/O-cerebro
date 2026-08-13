# 06 — SOURCE DISCOVERY & SEMANTIC ONBOARDING

Versão 1.0-draft · 2026-08-13

Nenhuma fonte alimenta KPI antes de concluir este processo.

## Etapas
1. **Inventory** — engine, versão, bancos, schemas, tabelas, views, colunas, tipos, nullability, defaults, PKs, FKs, uniques, índices, contagens estimadas, tamanho.
2. **Dictionary discovery** — procurar objetos com padrões `dictionary, data_dictionary, dicionario, dicionario_dados, metadata, metadados, schema_dictionary, field_description, column_dictionary`. Na fonte Lokan existe `v_Dicionario_Dados` (fonte prioritária de metadata). Descobrir primeiro a estrutura da própria view; não assumir nomes de coluna.
3. **Profiling seguro** — por coluna relevante: contagens, nulos, distintos, min/max, média/mediana/percentis, comprimentos, valores comuns, padrões, inválidos; datas (min/max, taxa de datas futuras/inválidas); monetários (zeros, negativos, outliers); identificadores (taxa de duplicidade, overlap referencial). Amostragem estatística e limites de linha/tempo — nunca varredura ampla.
4. **Table classification** — MASTER, TRANSACTION, EVENT, DIMENSION, LOOKUP, BRIDGE, HISTORY, AUDIT, CONFIGURATION, INTEGRATION, REPORTING, UNKNOWN. Baixa confiança não publica.
5. **Entity inference** — conceito empresarial, preservando semântica ampla (`pessoa` → Party, não Customer).
6. **Relationship inference** — evidência declarativa (FK) + dicionário + nomenclatura + overlap estatístico, cada relação com confidence e evidências.
7. **PII detection** — CPF, CNPJ, RG, e-mail, telefone, endereço, filiação, observações livres.
8. **Semantic Mapping Proposal** — human-in-the-loop: APPROVE / EDIT / REJECT, com `approved_by`, `approved_at`, `mapping_version`.
9. **SourceSemanticContract** versionado (doc 07).
10. **Drift monitor** — new/removed table, new/removed column, type/nullable changed, relationship changed, dictionary description changed → proposta, nunca publicação automática.

## Restrições operacionais aprendidas na fonte Lokan (respeitar)
- Executar consultas de descoberta **em série**; concorrência derruba a conexão.
- Preferir `sys.tables` / `sys.columns` a `INFORMATION_SCHEMA`; evitar `LIKE` amplo em catálogo.
- Paginar por chave (`TOP` + cursor de PK) em vez de varreduras.
- Filtros de data sargáveis (comparação por range, sem funções sobre a coluna).
- Timeout curto por consulta; agregação pesada fora do caminho de navegação.

## Entregável por fonte: Source Onboarding Report
Source Overview · Schema Inventory · Candidate Business Domains · Table Classification · Relationship Map · Data Quality Profile · PII Detection · Semantic Mapping Proposals · Canonical Mapping Coverage · Unknown Concepts · Ambiguities · Questions Requiring Human Review · Trust Score · Recommended Next Steps

## Data Trust Score
`Discovery Score · Semantic Understanding Score · Data Quality Score · Mapping Coverage · Freshness Score · Overall Trust Score` — exibido ao executivo para responder "estamos olhando um número confiável?".

## Status atual da fonte Lokan (Matriz)
| Item | Situação |
|---|---|
| Inventory persistido | ❌ (descoberta ao vivo e descartada) |
| Dicionário interpretado | parcial (`v_Dicionario_Dados` acessível) |
| Profiling | ❌ |
| Classificação de tabelas | ❌ |
| Relacionamentos com evidência | parcial e tácito |
| PII classificada | ❌ |
| Semantic Contract aprovado | ❌ |
| Overall Trust | **baixo** — KPIs atuais são não oficiais |