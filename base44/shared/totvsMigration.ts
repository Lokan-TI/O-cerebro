// Saneamento para migração Sisloc → TOTVS (Protheus): CAR → SE1, CAP → SE2.
// Regra de identidade pedida pelo negócio: o código do parceiro são os 8 primeiros
// dígitos do CNPJ e a loja são os 4 dígitos seguintes (o bloco após a "/").
// Nenhum campo é inventado: tudo que não existe no Sisloc sai vazio e é sinalizado
// na coluna de saneamento, para nada entrar poluído ou faltando no TOTVS.

export const SE1_COLUMNS = [
  ['E1_FILIAL', 'Filial'],
  ['SISLOC_FILIAL_NOME', 'Filial — nome no Sisloc'],
  ['SISLOC_FILIAL_CNPJ', 'Filial — CNPJ'],
  ['E1_CLIENTE', 'Código do cliente (8 primeiros do CNPJ)'],
  ['E1_LOJA', 'Loja (4 dígitos após a /)'],
  ['E1_NOMCLI', 'Nome do cliente (auxiliar — X3 marca "não usado")'],
  ['E1_PREFIXO', 'Prefixo (C3)'],
  ['E1_NUM', 'Nº do título (C9)'],
  ['E1_PARCELA', 'Parcela (C2)'],
  ['E1_EMISSAO', 'Emissão'],
  ['E1_VENCTO', 'Vencimento'],
  ['E1_VENCREA', 'Vencimento real'],
  ['E1_VENCORI', 'Vencimento original'],
  ['E1_VALOR', 'Valor do título'],
  ['E1_SALDO', 'Saldo'],
  ['E1_VLCRUZ', 'Valor em moeda nacional (R$)'],
  ['E1_MOEDA', 'Moeda'],
  ['E1_STATUS', 'Status'],
  ['E1_FLUXO', 'Fluxo de caixa'],
  ['E1_NATUREZ', 'Natureza — código (C10)'],
  ['E1_TIPO', 'Tipo do título (C3)'],
  ['E1_HIST', 'Histórico (C40)'],
  ['E1_XOBS', 'Observação completa'],
  ['E1_BAIXA', 'Data da baixa'],
  ['NATUREZA_DESCRICAO', 'Natureza financeira — Descrição'],
  ['NATUREZA_TIPO', 'Natureza financeira — Tipo de movimentação'],
  ['NATUREZA_STATUS', 'Natureza financeira — Status (A=Ativo / I=Inativo)'],
  ['NATUREZA_BALANCETE', 'Natureza financeira — Balancete (S/N)'],
  ['SISLOC_CD_LAN', 'Sisloc — ID do lançamento'],
  ['SISLOC_DOCUMENTO', 'Sisloc — CNPJ/CPF completo'],
  ['SISLOC_EMPRESA', 'Sisloc — Código da empresa/filial'],
  ['SISLOC_CONTA_BANCARIA', 'Sisloc — Conta bancária do título'],
  ['SISLOC_NATUREZA_RATEIOS', 'Sisloc — Qtd. de naturezas rateadas'],
  ['SANEAMENTO', 'Pendências de saneamento'],
];

export const SE2_COLUMNS = [
  ['E2_FILIAL', 'Filial'],
  ['SISLOC_FILIAL_NOME', 'Filial — nome no Sisloc'],
  ['SISLOC_FILIAL_CNPJ', 'Filial — CNPJ'],
  ['E2_FORNECE', 'Código do fornecedor (8 primeiros do CNPJ)'],
  ['E2_LOJA', 'Loja (4 dígitos após a /)'],
  ['E2_NOMFOR', 'Nome do fornecedor (auxiliar — X3 marca "não usado")'],
  ['E2_PREFIXO', 'Prefixo (C3)'],
  ['E2_NUM', 'Nº do título (C9)'],
  ['E2_PARCELA', 'Parcela (C2)'],
  ['E2_EMISSAO', 'Emissão'],
  ['E2_VENCTO', 'Vencimento'],
  ['E2_VENCREA', 'Vencimento real'],
  ['E2_VENCORI', 'Vencimento original'],
  ['E2_VALOR', 'Valor do título'],
  ['E2_SALDO', 'Saldo'],
  ['E2_VLCRUZ', 'Valor em moeda nacional (R$)'],
  ['E2_MOEDA', 'Moeda'],
  ['E2_STATUS', 'Status'],
  ['E2_FLUXO', 'Fluxo de caixa'],
  ['E2_NATUREZ', 'Natureza — código (C10)'],
  ['E2_TIPO', 'Tipo do título (C3)'],
  ['E2_HIST', 'Histórico (C40)'],
  ['E2_XOBS', 'Observação completa'],
  ['E2_BAIXA', 'Data da baixa'],
  ['NATUREZA_DESCRICAO', 'Natureza financeira — Descrição'],
  ['NATUREZA_TIPO', 'Natureza financeira — Tipo de movimentação'],
  ['NATUREZA_STATUS', 'Natureza financeira — Status (A=Ativo / I=Inativo)'],
  ['NATUREZA_BALANCETE', 'Natureza financeira — Balancete (S/N)'],
  ['SISLOC_NR_DOCTO', 'Sisloc — Nº documento (lanca.nr_doc_lan)'],
  ['SISLOC_TIPO_DOCTO', 'Sisloc — Tipo documento (docto.nm_docto)'],
  ['SISLOC_SG_DOCTO', 'Sisloc — Tipo documento (sigla)'],
  ['SISLOC_CREDOR', 'Sisloc — Credor (pessoa.cd_pessoa_cre)'],
  ['SISLOC_CREDOR_CNPJ', 'Sisloc — CNPJ/CPF do credor formatado'],
  ['SISLOC_COMPETENCIA', 'Sisloc — Competência (lanca.dt_competencia)'],
  ['SISLOC_DT_PREVISTA', 'Sisloc — Prevista (lanca.dt_prevista_lan)'],
  ['SISLOC_VL_PREVISTO', 'Sisloc — ( = ) Previsto (vl_pre_cap)'],
  ['SISLOC_STATUS_COD', 'Sisloc — Status (código fl_status_titulo)'],
  ['SISLOC_CD_LAN', 'Sisloc — ID do lançamento'],
  ['SISLOC_DOCUMENTO', 'Sisloc — CNPJ/CPF completo'],
  ['SISLOC_EMPRESA', 'Sisloc — Código da empresa/filial'],
  ['SISLOC_CONTA_BANCARIA', 'Sisloc — Conta bancária do título'],
  ['SISLOC_NATUREZA_RATEIOS', 'Sisloc — Qtd. de naturezas rateadas'],
  ['SANEAMENTO', 'Pendências de saneamento'],
];

export function getTotvsLayout(doc: string) {
  const cols = doc === 'cap' ? SE2_COLUMNS : SE1_COLUMNS;
  return { doc, columns: cols.map(([id, label]) => ({ id, label })) };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Filtro de status para o saneamento (fl_status no CAR, fl_status_titulo no CAP —
// domínio oficial do dicionário: 5=Provisório · 10=Aberto · 25/30=Liquidado · 40=Cancelado · 50=Renegociado · 60=PCLD).
// "Vencido" é avaliado contra a data de hoje.
const STATUS_FILTERS: Record<string, (st: string, ven: string) => string> = {
  aberto_vencido: (st, ven) => `(${st} = 10 AND ${ven} < CAST(GETDATE() AS date))`,
  aberto_a_vencer: (st, ven) => `(${st} = 10 AND (${ven} >= CAST(GETDATE() AS date) OR ${ven} IS NULL))`,
  provisorio: (st) => `(${st} = 5)`,
};

function statusWhere(statuses: string[] | undefined, st: string, ven: string) {
  const conds = (Array.isArray(statuses) ? statuses : [])
    .filter((s) => STATUS_FILTERS[s])
    .map((s) => STATUS_FILTERS[s](st, ven));
  return conds.length ? ` AND (${conds.join(' OR ')})` : '';
}

// Limpa o documento (só dígitos) — os campos do Sisloc vêm com máscara inconsistente.
const DOC_CLEAN = (col: string) =>
  `REPLACE(REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(COALESCE(${col}, ''))), '.', ''), '-', ''), '/', ''), ' ', '')`;

function baseCte(doc: string, startDate: string, endDate: string, statuses?: string[]) {
  const isCap = doc === 'cap';
  if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) throw new Error('Período inválido.');

  const emi = isCap ? 'dt_emi_cap' : 'dt_emi_car';
  const ven = isCap ? 'dt_ven_cap' : 'dt_ven_car';
  const bai = isCap ? 'dt_bai_cap' : 'dt_bai_car';
  const vlp = isCap ? 'vl_pre_cap' : 'vl_pre_car';
  const vla = isCap ? 'vl_acr_cap' : 'vl_acr_car';
  const vld = isCap ? 'vl_des_cap' : 'vl_des_car';
  const tp = isCap ? 'tp_cap' : 'tp_car';
  const hist = isCap ? 'ob_cap' : 'ob_car';
  const pes = isCap ? 'c.cd_pessoa_cre' : 'c.cd_pessoa_cli';
  const table = isCap ? 'cap' : 'car';
  const stCol = isCap ? 'c.fl_status_titulo' : 'c.fl_status';
  // Empresa (filial): CAR tem empresa gestora própria; CAP herda do rateio do
  // lançamento (lan_xcr.cd_empresa) e, na falta, da conta bancária do título.
  const empresaExpr = isCap
    ? 'COALESCE(la.cd_empresa, lx.cd_empresa, co.cd_empresa)'
    : 'COALESCE(c.cd_empresa_gestora, lx.cd_empresa, co.cd_empresa)';

  const cancel = isCap ? '' : ' AND c.dt_cancelamento IS NULL';
  // CAP não possui nf_numero: o nº do título vem do documento de origem / do próprio lançamento.
  const numExpr = isCap
    ? `COALESCE(NULLIF(LTRIM(RTRIM(COALESCE(la.nr_doc_lan, ''))), ''), CAST(c.cd_lan AS varchar(30)))`
    : `COALESCE(NULLIF(CAST(c.nf_numero AS varchar(30)), ''), CAST(c.cd_lan AS varchar(30)))`;
  const docExpr = `${DOC_CLEAN(`NULLIF(p.nr_cnpj_pessoa, '')`)}`;
  const cpfExpr = `${DOC_CLEAN('p.nr_cpf_pessoa')}`;
  // doc_num é calculado uma única vez no APPLY abaixo (dn.dn) para manter o SQL curto.
  const docNumApply = `OUTER APPLY (SELECT CASE WHEN LEN(${docExpr}) IN (11, 14) THEN ${docExpr} ELSE ${cpfExpr} END AS dn) dn`;
  // Máscara oficial: CNPJ xx.xxx.xxx/xxxx-xx (raiz + loja) e CPF xxx.xxx.xxx-xx.
  const docFmt = `CASE
        WHEN LEN(dn.dn) = 14 THEN SUBSTRING(dn.dn,1,2) + '.' + SUBSTRING(dn.dn,3,3) + '.' + SUBSTRING(dn.dn,6,3) + '/' + SUBSTRING(dn.dn,9,4) + '-' + SUBSTRING(dn.dn,13,2)
        WHEN LEN(dn.dn) = 11 THEN SUBSTRING(dn.dn,1,3) + '.' + SUBSTRING(dn.dn,4,3) + '.' + SUBSTRING(dn.dn,7,3) + '-' + SUBSTRING(dn.dn,10,2)
        ELSE '' END`;

  return `WITH src AS (
    SELECT
      c.cd_lan,
      dn.dn AS doc_num,
      ${docFmt} AS doc_fmt,
      LTRIM(RTRIM(COALESCE(la.nr_doc_lan, ''))) AS nr_docto,
      LTRIM(RTRIM(COALESCE(dc.nm_docto, ''))) AS docto_nome,
      LTRIM(RTRIM(COALESCE(dc.sg_docto, ''))) AS docto_sigla,
      la.dt_competencia AS dt_competencia,
      la.dt_prevista_lan AS dt_prevista,
      ROUND(COALESCE(c.${vlp}, 0), 2) AS vl_previsto,
      ${stCol} AS status_cod,
      LTRIM(RTRIM(COALESCE(NULLIF(p.nm_fan_pessoa, ''), p.nm_pessoa, ''))) AS nome,
      ${empresaExpr} AS empresa_cd,
      LTRIM(RTRIM(COALESCE(NULLIF(e.nm_fan_empresa, ''), e.nm_razsoc_empresa, ''))) AS empresa_nome,
      ${DOC_CLEAN('e.cnpj_empresa')} AS empresa_cnpj,
      LTRIM(RTRIM(COALESCE(co.nm_conta, ''))) AS conta_banco,
      COALESCE(lx.rateios, 0) AS natureza_rateios,
      LTRIM(RTRIM(COALESCE(c.${tp}, ''))) AS tp_titulo,
      c.${emi} AS dt_emissao,
      c.${ven} AS dt_vencto,
      c.${bai} AS dt_baixa,
      ROUND(COALESCE(c.${vlp}, 0) + COALESCE(c.${vla}, 0) - COALESCE(c.${vld}, 0), 2) AS valor,
      LTRIM(RTRIM(COALESCE(pl.nr_planfin, ''))) AS natureza_cod,
      LTRIM(RTRIM(COALESCE(pl.ds_planfin, ''))) AS natureza,
      CASE
        WHEN LEFT(LTRIM(RTRIM(COALESCE(pl.nr_planfin, ''))), 1) = '1' THEN 'ENTRADA'
        WHEN LEFT(LTRIM(RTRIM(COALESCE(pl.nr_planfin, ''))), 1) = '2' THEN 'SAIDA'
        ELSE ''
      END AS natureza_tipo,
      LTRIM(RTRIM(COALESCE(pl.fl_planfin, ''))) AS natureza_status,
      LTRIM(RTRIM(COALESCE(pl.fl_balancete, ''))) AS natureza_balancete,
      LTRIM(RTRIM(COALESCE(CAST(c.${hist} AS varchar(4000)), ''))) AS historico,
      ${numExpr} AS num_titulo,
      ROW_NUMBER() OVER (
        PARTITION BY ${numExpr}, ${pes}
        ORDER BY c.${ven}, c.cd_lan
      ) AS parcela,
      CASE
        WHEN ${stCol} = 5 THEN 'Titulo em aberto (Provisório)'
        WHEN ${stCol} = 40 THEN 'Titulo cancelado'
        WHEN ${stCol} = 50 THEN 'Titulo renegociado'
        WHEN ${stCol} = 60 THEN 'Titulo em perda (PCLD)'
        WHEN ${stCol} IN (25, 30) OR c.${bai} IS NOT NULL THEN 'Titulo baixado'
        WHEN c.${ven} < CAST(GETDATE() AS date) THEN 'Titulo em aberto (Vencido)'
        ELSE 'Titulo em aberto (A vencer)'
      END AS status_titulo,
      CASE WHEN ${stCol} IN (5, 10) AND c.${bai} IS NULL${cancel} THEN 1 ELSE 0 END AS em_aberto
    FROM ${table} c WITH (NOLOCK)
    LEFT JOIN pessoa p WITH (NOLOCK) ON p.cd_pessoa = ${pes}
    ${docNumApply}
    LEFT JOIN lanca la WITH (NOLOCK) ON la.cd_lan = c.cd_lan
    LEFT JOIN docto dc WITH (NOLOCK) ON dc.cd_docto = la.cd_docto
    OUTER APPLY (
      SELECT TOP 1 l.cd_planfin, l.cd_empresa, COUNT(*) OVER () AS rateios
      FROM lan_xcr l WITH (NOLOCK) WHERE l.cd_lan = c.cd_lan ORDER BY l.id_row
    ) lx
    LEFT JOIN plano pl WITH (NOLOCK) ON pl.cd_planfin = lx.cd_planfin
    LEFT JOIN conta co WITH (NOLOCK) ON co.cd_conta = c.cd_conta
    LEFT JOIN empresa e WITH (NOLOCK) ON e.cd_empresa = ${empresaExpr}
    WHERE c.${emi} >= '${startDate}' AND c.${emi} < DATEADD(day, 1, CAST('${endDate}' AS date))${statusWhere(statuses, stCol, `c.${ven}`)}
  )`;
}

// Montagem final no layout TOTVS (SE1/SE2), paginada.
export function buildTotvsSql({ doc, startDate, endDate, offset, pageSize, statuses }: {
  doc: string; startDate: string; endDate: string; offset: number; pageSize: number; statuses?: string[];
}) {
  const isCap = doc === 'cap';
  const off = Math.max(Number(offset) || 0, 0);
  const size = Math.min(Math.max(Number(pageSize) || 5000, 1), 10000);

  const codigo = `CASE WHEN LEN(doc_num) IN (11, 14) THEN LEFT(doc_num, 8) ELSE '' END`;
  const loja = `CASE WHEN LEN(doc_num) = 14 THEN SUBSTRING(doc_num, 9, 4) WHEN LEN(doc_num) = 11 THEN '0001' ELSE '' END`;
  const filial = `CASE WHEN empresa_cd IS NULL THEN '' ELSE '01' + RIGHT('00' + CAST(empresa_cd AS varchar(4)), 2) END`;

  const saneamento = `LTRIM(
    CASE WHEN LEN(doc_num) NOT IN (11, 14) THEN ' SEM CNPJ/CPF VALIDO;' ELSE '' END +
    CASE WHEN nome = '' THEN ' SEM NOME;' ELSE '' END +
    CASE WHEN empresa_cd IS NULL THEN ' SEM FILIAL;' ELSE '' END +
    CASE WHEN natureza_cod = '' THEN ' SEM NATUREZA FINANCEIRA NO LANCAMENTO;' ELSE '' END +
    CASE WHEN natureza_rateios > 1 THEN ' TITULO RATEADO EM MAIS DE UMA NATUREZA;' ELSE '' END +
    CASE WHEN valor <= 0 THEN ' VALOR ZERADO OU NEGATIVO;' ELSE '' END +
    CASE WHEN dt_vencto IS NULL THEN ' SEM VENCIMENTO;' ELSE '' END +
    CASE WHEN tp_titulo = '' THEN ' SEM TIPO DE TITULO (E2_TIPO/E1_TIPO);' ELSE '' END${isCap ? `+
    CASE WHEN nr_docto = '' THEN ' SEM Nº DOCUMENTO;' ELSE '' END +
    CASE WHEN docto_nome = '' THEN ' SEM TIPO DE DOCUMENTO;' ELSE '' END` : ''}
  )`;

  // Colunas de conferência exclusivas do CAP (dicionário Sisloc: nr_docto, tipo documento,
  // credor, competência, prevista, previsto e status).
  const capExtras = isCap
    ? `
    nr_docto AS SISLOC_NR_DOCTO,
    docto_nome AS SISLOC_TIPO_DOCTO,
    docto_sigla AS SISLOC_SG_DOCTO,
    nome AS SISLOC_CREDOR,
    doc_fmt AS SISLOC_CREDOR_CNPJ,
    CONVERT(char(10), dt_competencia, 23) AS SISLOC_COMPETENCIA,
    CONVERT(char(10), dt_prevista, 23) AS SISLOC_DT_PREVISTA,
    vl_previsto AS SISLOC_VL_PREVISTO,
    status_cod AS SISLOC_STATUS_COD,`
    : '';

  const p = isCap ? 'E2' : 'E1';
  const nameCol = isCap ? 'E2_NOMFOR' : 'E1_NOMCLI';
  const codeCol = isCap ? 'E2_FORNECE' : 'E1_CLIENTE';

  return `${baseCte(doc, startDate, endDate, statuses)}
  SELECT
    ${filial} AS ${p}_FILIAL,
    empresa_nome AS SISLOC_FILIAL_NOME,
    empresa_cnpj AS SISLOC_FILIAL_CNPJ,
    ${codigo} AS ${codeCol},
    ${loja} AS ${p}_LOJA,
    nome AS ${nameCol},
    '1' AS ${p}_PREFIXO,
    LEFT(num_titulo, 9) AS ${p}_NUM,
    CAST(parcela AS varchar(2)) AS ${p}_PARCELA,
    CONVERT(char(10), dt_emissao, 23) AS ${p}_EMISSAO,
    CONVERT(char(10), dt_vencto, 23) AS ${p}_VENCTO,
    CONVERT(char(10), dt_vencto, 23) AS ${p}_VENCREA,
    CONVERT(char(10), dt_vencto, 23) AS ${p}_VENCORI,
    valor AS ${p}_VALOR,
    CASE WHEN em_aberto = 1 THEN valor ELSE 0 END AS ${p}_SALDO,
    valor AS ${p}_VLCRUZ,
    '1' AS ${p}_MOEDA,
    status_titulo AS ${p}_STATUS,
    'SIM' AS ${p}_FLUXO,
    natureza_cod AS ${p}_NATUREZ,
    tp_titulo AS ${p}_TIPO,
    LEFT(historico, 40) AS ${p}_HIST,
    historico AS ${p}_XOBS,
    CONVERT(char(10), dt_baixa, 23) AS ${p}_BAIXA,${capExtras}
    natureza AS NATUREZA_DESCRICAO,
    natureza_tipo AS NATUREZA_TIPO,
    natureza_status AS NATUREZA_STATUS,
    natureza_balancete AS NATUREZA_BALANCETE,
    cd_lan AS SISLOC_CD_LAN,
    doc_num AS SISLOC_DOCUMENTO,
    empresa_cd AS SISLOC_EMPRESA,
    conta_banco AS SISLOC_CONTA_BANCARIA,
    natureza_rateios AS SISLOC_NATUREZA_RATEIOS,
    ${saneamento} AS SANEAMENTO
  FROM src
  ORDER BY cd_lan
  OFFSET ${off} ROWS FETCH NEXT ${size} ROWS ONLY`;
}

// Contagem total + resumo de pendências, para o painel de saneamento.
export function buildTotvsCountSql({ doc, startDate, endDate, statuses }: { doc: string; startDate: string; endDate: string; statuses?: string[]; }) {
  const isCap = doc === 'cap';
  return `${baseCte(doc, startDate, endDate, statuses)}
  SELECT
    COUNT(*) AS total,
    SUM(CASE WHEN LEN(doc_num) NOT IN (11, 14) THEN 1 ELSE 0 END) AS sem_documento,
    SUM(CASE WHEN nome = '' THEN 1 ELSE 0 END) AS sem_nome,
    SUM(CASE WHEN empresa_cd IS NULL THEN 1 ELSE 0 END) AS sem_filial,
    SUM(CASE WHEN natureza_cod = '' THEN 1 ELSE 0 END) AS sem_natureza,
    SUM(CASE WHEN valor <= 0 THEN 1 ELSE 0 END) AS valor_invalido,
    SUM(CASE WHEN dt_vencto IS NULL THEN 1 ELSE 0 END) AS sem_vencimento,
    SUM(CASE WHEN em_aberto = 1 THEN 1 ELSE 0 END) AS em_aberto,
    ROUND(SUM(valor), 2) AS valor_total,
    ROUND(SUM(CASE WHEN em_aberto = 1 THEN valor ELSE 0 END), 2) AS saldo_total,
    CONVERT(char(10), MIN(dt_emissao), 23) AS emissao_min,
    CONVERT(char(10), MAX(dt_emissao), 23) AS emissao_max
  FROM src`;
}