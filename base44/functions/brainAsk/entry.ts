import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { execRead } from '../../shared/erpConnection.ts';
import { assertReadOnlyQuery, SqlGuardError } from '../../shared/sqlGuard.ts';
import { INVOICE_UNIVERSE, INVOICE_DATE_FIELD } from '../../shared/metricRegistry.ts';
import { loadTableIndex, renderTableIndex, loadColumnsFor } from '../../shared/brainSchema.ts';
import { loadLessons, saveLesson, hasLesson } from '../../shared/brainMemory.ts';

// "Cérebro" — pergunta em linguagem natural → SQL somente leitura → resposta com dados reais.
// Reusa o SqlGuard (P0-02) e a conexão isolada por fonte. Toda consulta é auditada.

const MAX_ROWS_FOR_ANSWER = 150;

// Passo 0 — o Cérebro escolhe, no índice de TODAS as tabelas conectadas, quais precisa consultar.
async function selectTables(base44: any, question: string, index: any[]): Promise<string[]> {
  if (index.length === 0) return [];
  try {
    const pick = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Banco do ERP Sisloc (SQL Server). Lista COMPLETA de tabelas disponíveis:
${renderTableIndex(index)}

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
    const chosenTables = await selectTables(base44, question, tableIndex);
    let schemaBrief = await loadColumnsFor(base44, chosenTables);
    const today = new Date().toISOString().slice(0, 10);

    // Passo 1 — gerar SQL (ou decidir que o snapshot basta)
    const plan = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Você gera consultas SQL Server (T-SQL) somente leitura para o ERP Sisloc de uma locadora de equipamentos.
Data de hoje: ${today}.

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
- Sem período informado na pergunta: use o ano corrente (>= '${today.slice(0, 4)}-01-01').
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
- CADASTROS NOVOS de clientes → pessoa: data do cadastro = dt_cad_pessoa, cliente = fl_cliente_pessoa = 1 (bit), chave = cd_pessoa, nome = nm_pessoa. "Cadastros novos no período" = COUNT(*) em pessoa com fl_cliente_pessoa='S' e dt_cad_pessoa no intervalo.
- É PROIBIDO inventar tabela/coluna: use somente o que está no dicionário. Orçamento é SEMPRE mkt_orcamento e contrato é SEMPRE fich_loc — nunca use car/cap para isso.
- CONVERSÃO de cadastro novo: cadastro virou ORÇAMENTO se existe mkt_orcamento com cd_pessoa_cli = pessoa.cd_pessoa; virou CONTRATO se existe fich_loc com cd_pessoa = pessoa.cd_pessoa; virou FATURADO se existe nf (universo válido) com cd_pessoa = pessoa.cd_pessoa. Conte com EXISTS/LEFT JOIN + COUNT(DISTINCT), nunca com TOP.
- FINAL DE SEMANA = DATEPART(WEEKDAY, coluna) IN (1, 7) combinado ao intervalo de datas.

PERGUNTA DO GESTOR: ${question}`,
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
    let truncated = false;
    let queryError: string | null = null;

    if (plan?.needs_query && plan?.sql) {
      let candidate = plan.sql;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          executedSql = assertReadOnlyQuery(candidate);
          const result = await execRead(source, executedSql, 25000);
          const all = result.recordset || [];
          truncated = all.length > MAX_ROWS_FOR_ANSWER;
          rows = truncated ? all.slice(0, MAX_ROWS_FOR_ANSWER) : all;
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
Atenção a tipos: colunas fl_* costumam ser bit (use = 1 ou = 0, nunca 'S'/'N'); códigos cd_* são numéricos.
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

RESUMO EXECUTIVO (snapshot pré-calculado):
${context || '(sem snapshot carregado)'}

${rows.length > 0 ? `RESULTADO DA CONSULTA AO BANCO (ao vivo, ${rows.length} linhas${truncated ? ', truncado' : ''}):
SQL: ${executedSql}
DADOS: ${JSON.stringify(rows).slice(0, 12000)}` : ''}
${queryError ? `OBS: a consulta ao banco falhou (${queryError}). Responda com o que o resumo permite e diga o que não foi possível apurar.` : ''}
${!plan?.needs_query ? 'OBS: pergunta respondível sem consulta ao banco.' : ''}

PERGUNTA DO GESTOR: ${question}`,
    });

    return Response.json({
      answer,
      sql: rows.length > 0 ? executedSql : null,
      tables: chosenTables,
      rowCount: rows.length,
      truncated,
      queryError,
      duration_ms: Date.now() - started,
    });
  } catch (error) {
    await audit({ outcome: 'error', block_reason: error?.message || String(error) });
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
});