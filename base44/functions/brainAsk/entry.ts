import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { execRead } from '../../shared/erpConnection.ts';
import { assertReadOnlyQuery, SqlGuardError } from '../../shared/sqlGuard.ts';
import { INVOICE_UNIVERSE, INVOICE_DATE_FIELD } from '../../shared/metricRegistry.ts';

// "Cérebro" — pergunta em linguagem natural → SQL somente leitura → resposta com dados reais.
// Reusa o SqlGuard (P0-02) e a conexão isolada por fonte. Toda consulta é auditada.

const MAX_ROWS_FOR_ANSWER = 150;

// Fallback mínimo caso o MetadataCatalog esteja vazio.
const FALLBACK_SCHEMA = `
nf (notas fiscais): cd_empresa, cd_pessoa, dt_emissao, vl_faturamento
pessoa (clientes/fornecedores): cd_pessoa, nm_pessoa
car (contas a receber): consultar dicionário antes de usar
cap (contas a pagar): consultar dicionário antes de usar
fich_loc (contratos de locação): cd_pessoa
patrimonio (ativos/equipamentos): consultar dicionário antes de usar`;

// Tabelas sempre incluídas no dicionário do Cérebro, mesmo se não marcadas como core.
const KEY_TABLES = ['fich_loc', 'mkt_orcamento', 'nf', 'pessoa', 'car', 'cap', 'patrimon'];

async function buildSchemaBrief(base44: any): Promise<string> {
  try {
    const core = await base44.asServiceRole.entities.MetadataCatalog.filter(
      { is_core_table: true },
      'table_name',
      2000,
    );
    const extraLists = await Promise.all(
      KEY_TABLES.map((t) =>
        base44.asServiceRole.entities.MetadataCatalog.filter({ table_name: t }, 'ordinal_position', 300),
      ),
    );
    const rows = [...(core || []), ...extraLists.flat()];
    if (rows.length === 0) return FALLBACK_SCHEMA;
    const byTable: Record<string, string[]> = {};
    const seen = new Set<string>();
    for (const r of rows) {
      const key = `${r.table_name}.${r.column_name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const t = r.table_name;
      if (!byTable[t]) byTable[t] = [];
      if (byTable[t].length < 45) {
        byTable[t].push(r.caption ? `${r.column_name} (${String(r.caption).slice(0, 60)})` : r.column_name);
      }
    }
    let brief = '';
    const ordered = Object.entries(byTable).sort(
      (a, b) => (KEY_TABLES.includes(b[0]) ? 1 : 0) - (KEY_TABLES.includes(a[0]) ? 1 : 0),
    );
    for (const [table, cols] of ordered) {
      const line = `${table}: ${cols.join(', ')}\n`;
      if (brief.length + line.length > 14000) break;
      brief += line;
    }
    return brief || FALLBACK_SCHEMA;
  } catch {
    return FALLBACK_SCHEMA;
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

    const schemaBrief = await buildSchemaBrief(base44);
    const today = new Date().toISOString().slice(0, 10);

    // Passo 1 — gerar SQL (ou decidir que o snapshot basta)
    const plan = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Você gera consultas SQL Server (T-SQL) somente leitura para o ERP Sisloc de uma locadora de equipamentos.
Data de hoje: ${today}.

DICIONÁRIO DE DADOS (tabela: colunas):
${schemaBrief}

REGRAS OBRIGATÓRIAS:
- Uma única instrução SELECT (pode usar WITH). Nunca use INSERT/UPDATE/DELETE/EXEC/DECLARE/SET/INTO/variáveis/tabelas temporárias/comentários.
- Use TOP (máx. TOP 200) APENAS quando retornar linhas de detalhe. NUNCA use TOP em agregações (COUNT/SUM/GROUP BY) nem dentro de CTEs que serão contadas — isso falsearia o número.
- Prefira uma consulta agregada simples que responda exatamente a pergunta. Evite CTEs desnecessárias e subconsultas correlacionadas pesadas.
- Se a pergunta pede qualquer número, quantidade, valor, lista, ranking ou período específico, needs_query = true SEMPRE (o resumo executivo não substitui a consulta).
- Perguntas com várias partes: cada parte é um indicador INDEPENDENTE. Gere UMA consulta no formato SELECT (SELECT COUNT(*) ... ) AS parte1, (SELECT COUNT(*) ... ) AS parte2. É PROIBIDO ligar indicadores independentes com JOIN/LEFT JOIN (gera duplicação e números errados).
- Para "quantos X converteram em Y", use EXISTS dentro do COUNT: SELECT COUNT(*) FROM pessoa p WHERE <filtros> AND EXISTS (SELECT 1 FROM <tabelaY> y WHERE y.<fk> = p.cd_pessoa).
- Sem período informado na pergunta: use o ano corrente (>= '${today.slice(0, 4)}-01-01').
- Filtros de data SEMPRE sargáveis: coluna >= 'AAAA-MM-DD' AND coluna < 'AAAA-MM-DD'. NUNCA use YEAR()/MONTH() na coluna. Para dia da semana, combine o intervalo sargável com DATEPART(WEEKDAY, coluna) (domingo=1, sábado=7).
- Use apenas tabelas e colunas do dicionário acima ou da semântica canônica abaixo.
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
          break;
        } catch (e) {
          queryError = e?.message || String(e);
          if (e instanceof SqlGuardError || attempt === 2) {
            await audit({ outcome: 'error', block_reason: queryError });
            break;
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