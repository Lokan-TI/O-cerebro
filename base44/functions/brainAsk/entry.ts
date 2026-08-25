import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { execRead } from '../../shared/erpConnection.ts';
import { assertReadOnlyQuery, SqlGuardError } from '../../shared/sqlGuard.ts';
import { INVOICE_UNIVERSE, INVOICE_DATE_FIELD } from '../../shared/metricRegistry.ts';
import { loadTableIndex, renderTableIndex, loadColumnsFor } from '../../shared/brainSchema.ts';
import { loadLessons, saveLesson, hasLesson } from '../../shared/brainMemory.ts';

// "Cérebro" — pergunta em linguagem natural → SQL somente leitura → resposta com dados reais.
// Reusa o SqlGuard (P0-02) e a conexão isolada por fonte. Toda consulta é auditada.

const MAX_ROWS_FOR_ANSWER = 150;
const MAX_ROWS_FOR_REPORT = 5000;

// Passo 0 — o Cérebro escolhe, no índice de TODAS as tabelas conectadas, quais precisa consultar.
// Histórico curto da conversa → texto para o LLM entender perguntas de continuidade ("e desses, quantos...").
function renderConversation(turns: any[]): string {
  if (!Array.isArray(turns) || turns.length === 0) return '';
  return turns
    .slice(-6)
    .map((t: any) => {
      const who = t?.role === 'user' ? 'GESTOR' : 'CÉREBRO';
      const txt = String(t?.text || '').slice(0, 900);
      const sql = t?.sql ? `\n  (SQL usado: ${String(t.sql).slice(0, 900)})` : '';
      return `${who}: ${txt}${sql}`;
    })
    .join('\n');
}

// Passo -1 — resolve referências ("desses", "esse valor", "detalhe isso") transformando a pergunta
// em uma pergunta autocontida. Se o pedido for só de apresentação/recorte do MESMO dado, reaproveita o SQL anterior.
async function resolveFollowUp(base44: any, question: string, convo: string, lastSql: string) {
  if (!convo) return { question, reuseSql: '' };
  try {
    const r = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `CONVERSA ANTERIOR entre um gestor e um analista de dados:
${convo}

NOVA MENSAGEM DO GESTOR: ${question}

Tarefas:
1) Reescreva a nova mensagem como uma pergunta AUTOCONTIDA em português, substituindo todos os pronomes e referências ("desses", "isso", "esse valor", "no mesmo período") pelos filtros, período, universo e entidades explícitos da conversa anterior. Se a mensagem já for autocontida, repita-a igual.
2) same_data = true se o gestor apenas quer o MESMO conjunto de dados de outra forma (formatação, ordenação, mais colunas de apresentação, exportar) sem alterar filtros nem o cálculo. Caso contrário, false.`,
      response_json_schema: {
        type: 'object',
        properties: {
          standalone_question: { type: 'string' },
          same_data: { type: 'boolean' },
        },
      },
    });
    return {
      question: (r?.standalone_question || '').trim() || question,
      reuseSql: r?.same_data && lastSql ? lastSql : '',
    };
  } catch {
    return { question, reuseSql: '' };
  }
}

async function selectTables(base44: any, question: string, index: any[], convo = ''): Promise<string[]> {
  if (index.length === 0) return [];
  try {
    const pick = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Banco do ERP Sisloc (SQL Server). Lista COMPLETA de tabelas disponíveis:
${renderTableIndex(index)}

${convo ? `CONVERSA ANTERIOR (a pergunta pode ser continuação dela):\n${convo}\n` : ''}
Pergunta do gestor: ${question}

Liste de 1 a 10 nomes EXATOS de tabelas dessa lista necessários para responder (inclua tabelas de apoio para cruzamento de dados, ex.: cadastros, grupos, filiais). Não invente nomes.`,
      response_json_schema: {
        type: 'object',
        properties: { tables: { type: 'array', items: { type: 'string' } } },
      },
    });
    const valid = new Set(index.map((t: any) => t.table_name));
    return (pick?.tables || []).filter((t: string) => valid.has(t)).slice(0, 10);
  } catch {
    return [];
  }
}

Deno.serve(async (req) => {
  const started = Date.now();
  let base44: any = null;
  let user: any = null;
  let source: any = null;
  let sourceId: string | null = null;
  let executedSql = '';

  const audit = async (fields: Record<string, unknown>) => {
    try {
      await base44?.asServiceRole.entities.ErpQueryAudit.create({
        user_id: user?.id || null,
        user_email: user?.email || null,
        user_role: user?.role || null,
        source_id: sourceId,
        source_name: source?.name || null,
        query: executedSql || '(gerada pelo Cérebro — não executada)',
        executed_at: new Date().toISOString(),
        duration_ms: Date.now() - started,
        ...fields,
      });
    } catch (e) {
      console.error('Falha ao registrar auditoria (brainAsk):', e?.message || e);
    }
  };

  try {
    base44 = createClientFromRequest(req);
    user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') {
      return Response.json({ error: 'Consulta ao banco restrita a administradores.' }, { status: 403 });
    }

    const body = await req.json();
    const question = (body?.question || '').trim();
    const context = typeof body?.context === 'string' ? body.context.slice(0, 9000) : '';
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    const uiPeriodStart = iso.test(String(body?.period_start || '')) ? String(body.period_start) : null;
    const uiPeriodEndInclusive = iso.test(String(body?.period_end_inclusive || '')) ? String(body.period_end_inclusive) : null;
    const uiPeriodEndExclusive = iso.test(String(body?.period_end_exclusive || '')) ? String(body.period_end_exclusive) : null;
    sourceId = body?.source_id || null;
    if (!question) return Response.json({ error: 'Pergunta vazia.' }, { status: 400 });

    if (sourceId) {
      source = await base44.asServiceRole.entities.ErpDataSource.get(sourceId);
      if (!source || source.is_active === false) {
        return Response.json({ error: 'Fonte de dados indisponível.' }, { status: 404 });
      }
    } else {
      source = { credential_reference: 'env' };
    }

    const [tableIndex, lessons] = await Promise.all([loadTableIndex(base44), loadLessons(base44)]);
    const convo = renderConversation(body?.conversation);
    const lastSql = [...(Array.isArray(body?.conversation) ? body.conversation : [])]
      .reverse()
      .find((t: any) => t?.sql)?.sql || '';
    const resolved = await resolveFollowUp(base44, question, convo, lastSql);
    const effectiveQuestion = resolved.question;
    const chosenTables = await selectTables(base44, effectiveQuestion, tableIndex, convo);
    let schemaBrief = await loadColumnsFor(base44, chosenTables);
    const today = new Date().toISOString().slice(0, 10);

    // Passo 1 — gerar SQL (ou decidir que o snapshot basta)
    const plan = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Você gera consultas SQL Server (T-SQL) somente leitura para o ERP Sisloc de uma locadora de equipamentos.
Data de hoje: ${today}.
PERÍODO GLOBAL APLICADO NO DASHBOARD: ${uiPeriodStart && uiPeriodEndExclusive ? `[${uiPeriodStart}, ${uiPeriodEndExclusive})` : '(não informado)'}${uiPeriodEndInclusive ? ` · fim inclusivo exibido: ${uiPeriodEndInclusive}` : ''}.

DICIONÁRIO DE DADOS (tabela: colunas [tipo] (descrição)):
${schemaBrief}

TABELAS DISPONÍVEIS NO BANCO (use apenas o dicionário acima; se faltar tabela, diga na nota):
${renderTableIndex(tableIndex, 400)}

${lessons || '(sem aprendizado registrado ainda)'}

REGRAS OBRIGATÓRIAS:
- Uma única instrução SELECT (pode usar WITH). Nunca use INSERT/UPDATE/DELETE/EXEC/DECLARE/SET/INTO/variáveis/tabelas temporárias/comentários.
- Use TOP (máx. TOP 200) APENAS quando retornar linhas de detalhe. NUNCA use TOP em agregações (COUNT/SUM/GROUP BY) nem dentro de CTEs que serão contadas — isso falsearia o número.
- Prefira uma consulta agregada simples que responda exatamente a pergunta. Evite CTEs desnecessárias e subconsultas correlacionadas pesadas.
- Se a pergunta pede qualquer número, quantidade, valor, lista, ranking ou período específico, needs_query = true SEMPRE (o resumo executivo não substitui a consulta).
- Perguntas com várias partes: cada parte é um indicador INDEPENDENTE. Gere UMA consulta no formato SELECT (SELECT COUNT(*) ... ) AS parte1, (SELECT COUNT(*) ... ) AS parte2. É PROIBIDO ligar indicadores independentes com JOIN/LEFT JOIN (gera duplicação e números errados).
- Para "quantos X converteram em Y", use EXISTS dentro do COUNT: SELECT COUNT(*) FROM pessoa p WHERE <filtros> AND EXISTS (SELECT 1 FROM <tabelaY> y WHERE y.<fk> = p.cd_pessoa).
- Sem período informado na pergunta: ${uiPeriodStart && uiPeriodEndExclusive ? `use EXATAMENTE o período global aplicado: coluna >= '${uiPeriodStart}' AND coluna < '${uiPeriodEndExclusive}'. Não substitua por ano corrente.` : `use o ano corrente (>= '${today.slice(0, 4)}-01-01').`} EXCEÇÃO: perguntas de segmentação/carteira de clientes (quem nunca orçou, orçou e sumiu, alugou e devolveu, listas para planilha) NÃO levam filtro de data — considere a base inteira, salvo período explícito na pergunta.
- Filtros de data SEMPRE sargáveis: coluna >= 'AAAA-MM-DD' AND coluna < 'AAAA-MM-DD'. NUNCA use YEAR()/MONTH() na coluna. Para dia da semana, combine o intervalo sargável com DATEPART(WEEKDAY, coluna) (domingo=1, sábado=7).
- REGRA DURA: só é permitido usar tabelas e colunas que aparecem no DICIONÁRIO DE DADOS acima (com colunas listadas). A lista "TABELAS DISPONÍVEIS" serve apenas para você saber o que existe — se precisar de uma tabela que não está no dicionário detalhado, escolha um caminho alternativo com as tabelas do dicionário ou retorne needs_query=false explicando na nota qual tabela falta.
- Nunca invente nomes como nf_itens, nf_item, orcamento, patrimonio: se não está no dicionário, não existe.
- Se a pergunta não precisa do banco (é conceitual ou já respondível pelo resumo executivo), retorne needs_query=false.

SEMÂNTICA CANÔNICA (obrigatória — é a mesma dos dashboards):
- Notas fiscais / faturamento → tabela nf. Valor = vl_faturamento (FATURAMENTO BRUTO de NF, não é "receita por grupo"). Data = ${INVOICE_DATE_FIELD}.
- Universo válido de NF de saída: ${INVOICE_UNIVERSE}. Copie este filtro LITERALMENTE ao contar/somar notas — não reescreva os flags.
- TIPOS: em nf os flags fl_* são varchar ('S'/'N'/'E') — nunca compare com número (fl_ent_sai = 1 causa erro de conversão). Em pessoa, fl_cliente_pessoa é bit (= 1).
- Cliente da nota = nf.cd_pessoa; nome em pessoa.nm_pessoa (JOIN por cd_pessoa). Empresa/filial = nf.cd_empresa.
- Contas a receber → car: valor vl_pre_car, emissão dt_emi_car, vencimento dt_ven_car, baixa dt_bai_car, cancelado dt_cancelamento IS NOT NULL, empresa cd_empresa_gestora. Vencido = dt_bai_car IS NULL AND dt_ven_car < GETDATE().
- Contas a pagar → cap. Ativos/equipamentos → patrimon (NÃO existe tabela "patrimonio").
- ORÇAMENTOS comerciais → tabela mkt_orcamento: data do orçamento = dt_orcamento (criação; alternativa dt_emissao), cliente = cd_pessoa_cli (nome via JOIN pessoa por cd_pessoa), empresa = cd_empresa, aprovação = dt_aprovacao, cancelado = dt_cancelamento IS NOT NULL, número = numero.
- CONTRATOS de locação → tabela fich_loc: abertura do contrato = dt_pedido, cliente = cd_pessoa (nome via JOIN pessoa), empresa = cd_empresa, período = dt_fai_ficha/dt_faf_ficha, encerrado = dt_enc_ficha IS NOT NULL, controle = cd_controle.
- "Gerados/criados em X" para orçamentos usa dt_orcamento; para contratos usa dt_pedido. NUNCA use lad_ins_date ou fl_remessa para isso.
- CADASTROS NOVOS de clientes → pessoa: data do cadastro = dt_cad_pessoa, cliente = fl_cliente_pessoa = 1 (bit), chave = cd_pessoa, nome = nm_pessoa. "Cadastros novos no período" = COUNT(*) em pessoa com fl_cliente_pessoa = 1 e dt_cad_pessoa no intervalo.
- É PROIBIDO inventar tabela/coluna: use somente o que está no dicionário. Orçamento é SEMPRE mkt_orcamento e contrato é SEMPRE fich_loc — nunca use car/cap para isso.
- CONVERSÃO de cadastro novo: cadastro virou ORÇAMENTO se existe mkt_orcamento com cd_pessoa_cli = pessoa.cd_pessoa; virou CONTRATO se existe fich_loc com cd_pessoa = pessoa.cd_pessoa; virou FATURADO se existe nf (universo válido) com cd_pessoa = pessoa.cd_pessoa. Conte com EXISTS/LEFT JOIN + COUNT(DISTINCT), nunca com TOP.
- FINAL DE SEMANA = DATEPART(WEEKDAY, coluna) IN (1, 7) combinado ao intervalo de datas.

SEGMENTOS DE CICLO DE VIDA DO CLIENTE (use EXATAMENTE estas definições quando o gestor citar esses comportamentos):
- "Criou cadastro e não tem nenhum orçamento" = pessoa com fl_cliente_pessoa = 1 e NOT EXISTS (mkt_orcamento com cd_pessoa_cli = pessoa.cd_pessoa).
- "Pediu orçamento e sumiu" = EXISTS mkt_orcamento (cd_pessoa_cli) e NOT EXISTS fich_loc (cd_pessoa) — orçou e nunca abriu contrato de locação.
- "Já alugou e devolveu equipamento" = EXISTS fich_loc com cd_pessoa = pessoa.cd_pessoa e dt_enc_ficha IS NOT NULL (contrato encerrado) e NOT EXISTS fich_loc em aberto (dt_enc_ficha IS NULL) para o mesmo cliente.

QUANDO O GESTOR PEDE CRUZAMENTO, LISTA, PLANILHA, RELATÓRIO OU EXCEL:
- Retorne LINHAS DE DETALHE (um cliente por linha), não apenas contagens.
- Inclua sempre uma coluna de classificação chamada segmento (valor textual do segmento) + colunas identificadoras: cd_pessoa, nm_pessoa, dt_cad_pessoa e as datas/valores relevantes ao segmento.
- Vários segmentos na mesma pergunta: use UNION ALL, um SELECT por segmento, cada um com sua constante em segmento (ex.: 'Cadastro sem orçamento' AS segmento). Nunca junte segmentos com JOIN.
- Nesses casos é permitido e recomendado usar TOP 200 por segmento com ORDER BY dt_cad_pessoa DESC.
- Formate valores monetários como número (não texto) e datas como data — a planilha é gerada a partir dessas colunas.

${convo ? `CONVERSA ANTERIOR (esta pergunta pode ser CONTINUAÇÃO dela):
${convo}

REGRA DE CONTEXTO: se a pergunta atual for de continuidade ("e desses", "detalhe isso", "abre por empresa", "no mesmo período", "com mais profundidade"), REAPROVEITE os filtros, período, universo e SQL da conversa anterior e apenas aplique o novo recorte pedido. Nunca reinicie do zero nem troque o período por conta própria.
${lastSql ? `SQL DA ÚLTIMA RESPOSTA (base para continuidade):\n${lastSql}\n` : ''}` : ''}
MENSAGEM ORIGINAL DO GESTOR: ${question}
PERGUNTA (já resolvida com o contexto da conversa — responda a esta): ${effectiveQuestion}`,
      response_json_schema: {
        type: 'object',
        properties: {
          needs_query: { type: 'boolean' },
          sql: { type: 'string' },
          note: { type: 'string' },
        },
      },
    });

    let rows: any[] = [];
    let reportRows: any[] = [];
    let truncated = false;
    let queryError: string | null = null;

    const sqlToRun = resolved.reuseSql || (plan?.needs_query ? plan?.sql : '');
    if (sqlToRun) {
      let candidate = sqlToRun;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          executedSql = assertReadOnlyQuery(candidate);
          const result = await execRead(source, executedSql, 25000);
          const all = result.recordset || [];
          truncated = all.length > MAX_ROWS_FOR_ANSWER;
          rows = truncated ? all.slice(0, MAX_ROWS_FOR_ANSWER) : all;
          reportRows = all.slice(0, MAX_ROWS_FOR_REPORT);
          queryError = null;
          await audit({ outcome: 'allowed', row_count: rows.length, truncated });
          if (!(await hasLesson(base44, question))) {
            await saveLesson(base44, {
              question,
              sql: executedSql,
              tables: chosenTables.join(', '),
              kind: 'success',
              source_id: sourceId || '',
              weight: 1,
            });
          }
          break;
        } catch (e) {
          queryError = e?.message || String(e);
          if (e instanceof SqlGuardError || attempt === 2) {
            await audit({ outcome: 'error', block_reason: queryError });
            break;
          }
          // Se faltou uma tabela que existe no banco, carrega o dicionário dela e tenta de novo.
          const missing = /Invalid object name '([^']+)'/.exec(queryError || '')?.[1]?.replace(/^dbo\./i, '');
          if (missing && tableIndex.some((t: any) => t.table_name === missing) && !chosenTables.includes(missing)) {
            chosenTables.push(missing);
            schemaBrief = await loadColumnsFor(base44, chosenTables);
          }
          // Uma retentativa: pede correção ao LLM com o erro real.
          const fix = await base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt: `A consulta T-SQL abaixo falhou. Corrija-a mantendo as mesmas regras (SELECT único, sem TOP em agregações, datas sargáveis, sem comentários/variáveis, indicadores independentes como subconsultas e não JOIN).
REGRA FISCAL IMUTÁVEL: se a consulta usa nf para faturamento/cliente faturado, preserve literalmente este universo e não altere seus tipos/flags: ${INVOICE_UNIVERSE}. Data fiscal = ${INVOICE_DATE_FIELD}.
Atenção a tipos: em nf, fl_ent_sai é textual ('S'); em pessoa, fl_cliente_pessoa é bit (= 1). Códigos cd_* são numéricos.
Orçamento = mkt_orcamento (cliente cd_pessoa_cli, data dt_orcamento). Contrato = fich_loc (cliente cd_pessoa, abertura dt_pedido). Cadastro de cliente = pessoa (dt_cad_pessoa, fl_cliente_pessoa = 1).
Use apenas o dicionário:
${schemaBrief.slice(0, 8000)}

CONSULTA: ${candidate}
ERRO: ${queryError}
PERGUNTA ORIGINAL: ${question}`,
            response_json_schema: {
              type: 'object',
              properties: { sql: { type: 'string' } },
            },
          });
          candidate = fix?.sql || candidate;
        }
      }
    }

    // Passo 2 — resposta executiva com os dados reais
    const answer = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Você é o "Cérebro" — consultor executivo sênior de uma locadora de equipamentos (ERP Sisloc).
Responda em português do Brasil, direto e objetivo, citando números reais. Use markdown leve. Máximo ~120 palavras.
REGRA ESSENCIAL: responda EXCLUSIVAMENTE o que foi perguntado. NÃO adicione insights extras, riscos, análises paralelas, recomendações, próximos passos, sugestões de ação nem observações não solicitadas. Sem seções adicionais. Apenas a resposta da dúvida, com os números que a sustentam.
Lembre: nf.vl_faturamento = faturamento bruto de NF (não é "receita por grupo Sisloc").
Se o gestor pedir planilha/Excel/CSV/relatório: a própria tela já oferece os botões de download (Excel, CSV, PDF, JSON) logo abaixo da sua resposta. NUNCA diga que não pode gerar arquivo — apenas resuma os números por segmento e diga que a planilha está disponível nos botões abaixo.

${convo ? `CONVERSA ANTERIOR (mantenha a continuidade; não repita o que já foi dito, apenas responda o novo pedido no mesmo contexto/período):\n${convo}\n` : ''}
RESUMO EXECUTIVO (snapshot pré-calculado):
${context || '(sem snapshot carregado)'}

${rows.length > 0 ? `RESULTADO DA CONSULTA AO BANCO (ao vivo, ${rows.length} linhas${truncated ? ', truncado' : ''}):
SQL: ${executedSql}
DADOS: ${JSON.stringify(rows).slice(0, 12000)}` : ''}
${queryError ? `OBS: a consulta ao banco falhou (${queryError}). Responda com o que o resumo permite e diga o que não foi possível apurar.` : ''}
${!sqlToRun ? 'OBS: pergunta respondível sem consulta ao banco.' : ''}

MENSAGEM ORIGINAL DO GESTOR: ${question}
${effectiveQuestion !== question ? `INTERPRETAÇÃO COM O CONTEXTO DA CONVERSA (responda a esta): ${effectiveQuestion}` : ''}`,
    });

    return Response.json({
      answer,
      sql: rows.length > 0 ? executedSql : null,
      tables: chosenTables,
      rows: reportRows,
      rowCount: rows.length,
      reportRowCount: reportRows.length,
      truncated,
      queryError,
      analysis_context: {
        period_start: uiPeriodStart,
        period_end_inclusive: uiPeriodEndInclusive,
        period_end_exclusive: uiPeriodEndExclusive,
      },
      duration_ms: Date.now() - started,
    });
  } catch (error) {
    await audit({ outcome: 'error', block_reason: error?.message || String(error) });
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
});