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
  ['E1_NOMCLI', 'Nome do cliente'],
  ['E1_PREFIXO', 'Prefixo'],
  ['E1_NUM', 'Nº do título'],
  ['E1_PARCELA', 'Parcela'],
  ['E1_TIPO', 'Tipo do título'],
  ['E1_EMISSAO', 'Emissão'],
  ['E1_VENCTO', 'Vencimento'],
  ['E1_VENCREA', 'Vencimento real'],
  ['E1_VALOR', 'Valor'],
  ['E1_SALDO', 'Saldo'],
  ['E1_MOEDA', 'Moeda'],
  ['E1_NATUREZ', 'Natureza (código da conta do plano financeiro)'],
  ['E1_STATUS', 'Status'],
  ['E1_BAIXA', 'Data da baixa'],
  ['E1_HIST', 'Histórico'],
  ['NATUREZA_DESCRICAO', 'Natureza financeira — Descrição'],
  ['NATUREZA_TIPO', 'Natureza financeira — Tipo de movimentação'],
  ['NATUREZA_STATUS', 'Natureza financeira — Status (A=Ativo / I=Inativo)'],
  ['NATUREZA_BALANCETE', 'Natureza financeira — Balancete (S/N)'],
  ['SISLOC_CD_LAN', 'Sisloc — ID do lançamento'],
  ['SISLOC_DOCUMENTO', 'Sisloc — CNPJ/CPF completo'],
  ['SISLOC_EMPRESA', 'Sisloc — Empresa gestora'],
  ['SANEAMENTO', 'Pendências de saneamento'],
];

export const SE2_COLUMNS = [
  ['E2_FILIAL', 'Filial'],
  ['E2_FORNECE', 'Código do fornecedor (8 primeiros do CNPJ)'],
  ['E2_LOJA', 'Loja (4 dígitos após a /)'],
  ['E2_NOMFOR', 'Nome do fornecedor'],
  ['E2_PREFIXO', 'Prefixo'],
  ['E2_NUM', 'Nº do título'],
  ['E2_PARCELA', 'Parcela'],
  ['E2_TIPO', 'Tipo do título'],
  ['E2_EMISSAO', 'Emissão'],
  ['E2_VENCTO', 'Vencimento'],
  ['E2_VENCREA', 'Vencimento real'],
  ['E2_VALOR', 'Valor'],
  ['E2_SALDO', 'Saldo'],
  ['E2_MOEDA', 'Moeda'],
  ['E2_NATUREZ', 'Natureza (código da conta do plano financeiro)'],
  ['E2_STATUS', 'Status'],
  ['E2_BAIXA', 'Data da baixa'],
  ['E2_HIST', 'Histórico'],
  ['NATUREZA_DESCRICAO', 'Natureza financeira — Descrição'],
  ['NATUREZA_TIPO', 'Natureza financeira — Tipo de movimentação'],
  ['NATUREZA_STATUS', 'Natureza financeira — Status (A=Ativo / I=Inativo)'],
  ['NATUREZA_BALANCETE', 'Natureza financeira — Balancete (S/N)'],
  ['SISLOC_CD_LAN', 'Sisloc — ID do lançamento'],
  ['SISLOC_DOCUMENTO', 'Sisloc — CNPJ/CPF completo'],
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

  const cancel = isCap ? '' : ' AND c.dt_cancelamento IS NULL';
  // CAP não possui nf_numero: o nº do título vem do documento de origem / do próprio lançamento.
  const numExpr = isCap
    ? `COALESCE(NULLIF(CAST(c.cd_controle AS varchar(30)), ''), CAST(c.cd_lan AS varchar(30)))`
    : `COALESCE(NULLIF(CAST(c.nf_numero AS varchar(30)), ''), CAST(c.cd_lan AS varchar(30)))`;
  const docExpr = `${DOC_CLEAN(`NULLIF(p.nr_cnpj_pessoa, '')`)}`;
  const cpfExpr = `${DOC_CLEAN('p.nr_cpf_pessoa')}`;

  return `WITH src AS (
    SELECT
      c.cd_lan,
      CASE WHEN LEN(${docExpr}) IN (11, 14) THEN ${docExpr} ELSE ${cpfExpr} END AS doc_num,
      LTRIM(RTRIM(COALESCE(NULLIF(p.nm_fan_pessoa, ''), p.nm_pessoa, ''))) AS nome,
      ${isCap
        ? `'' AS empresa_cd, '' AS empresa_nome, '' AS empresa_cnpj,`
        : `c.cd_empresa_gestora AS empresa_cd,
      LTRIM(RTRIM(COALESCE(NULLIF(e.nm_fan_empresa, ''), e.nm_razsoc_empresa, ''))) AS empresa_nome,
      ${DOC_CLEAN('e.cnpj_empresa')} AS empresa_cnpj,`}
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
        WHEN ${stCol} = 5 THEN 'PROVISORIO'
        WHEN ${stCol} = 40 THEN 'CANCELADO'
        WHEN ${stCol} = 50 THEN 'RENEGOCIADO'
        WHEN ${stCol} = 60 THEN 'PCLD'
        WHEN ${stCol} IN (25, 30) OR c.${bai} IS NOT NULL THEN 'BAIXADO'
        WHEN c.${ven} < CAST(GETDATE() AS date) THEN 'EM ABERTO (VENCIDO)'
        ELSE 'EM ABERTO (A VENCER)'
      END AS status_titulo,
      CASE WHEN ${stCol} IN (5, 10) AND c.${bai} IS NULL${cancel} THEN 1 ELSE 0 END AS em_aberto
    FROM ${table} c WITH (NOLOCK)
    LEFT JOIN pessoa p WITH (NOLOCK) ON p.cd_pessoa = ${pes}
    LEFT JOIN plano pl WITH (NOLOCK) ON pl.cd_planfin = c.cd_conta${isCap ? '' : `
    LEFT JOIN empresa e WITH (NOLOCK) ON e.cd_empresa = c.cd_empresa_gestora`}
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
  const filial = isCap ? `''` : `CASE WHEN empresa_cd IS NULL THEN '' ELSE '01' + RIGHT('00' + CAST(empresa_cd AS varchar(4)), 2) END`;

  const saneamento = `LTRIM(
    CASE WHEN LEN(doc_num) NOT IN (11, 14) THEN ' SEM CNPJ/CPF VALIDO;' ELSE '' END +
    CASE WHEN nome = '' THEN ' SEM NOME;' ELSE '' END +
    ${isCap ? `' SEM FILIAL (CAP NAO TEM EMPRESA NO SISLOC);'` : `CASE WHEN empresa_cd IS NULL THEN ' SEM FILIAL;' ELSE '' END`} +
    CASE WHEN natureza_cod = '' THEN ' CONTA FINANCEIRA NAO ENCONTRADA NO PLANO;' ELSE '' END +
    CASE WHEN valor <= 0 THEN ' VALOR ZERADO OU NEGATIVO;' ELSE '' END +
    CASE WHEN dt_vencto IS NULL THEN ' SEM VENCIMENTO;' ELSE '' END
  )`;

  const p = isCap ? 'E2' : 'E1';
  const nameCol = isCap ? 'E2_NOMFOR' : 'E1_NOMCLI';
  const codeCol = isCap ? 'E2_FORNECE' : 'E1_CLIENTE';

  return `${baseCte(doc, startDate, endDate, statuses)}
  SELECT
    ${filial} AS ${p}_FILIAL,
    ${isCap ? '' : 'empresa_nome AS SISLOC_FILIAL_NOME, empresa_cnpj AS SISLOC_FILIAL_CNPJ,'}
    ${codigo} AS ${codeCol},
    ${loja} AS ${p}_LOJA,
    nome AS ${nameCol},
    '' AS ${p}_PREFIXO,
    num_titulo AS ${p}_NUM,
    RIGHT('00' + CAST(parcela AS varchar(3)), 2) AS ${p}_PARCELA,
    tp_titulo AS ${p}_TIPO,
    CONVERT(char(10), dt_emissao, 23) AS ${p}_EMISSAO,
    CONVERT(char(10), dt_vencto, 23) AS ${p}_VENCTO,
    CONVERT(char(10), dt_vencto, 23) AS ${p}_VENCREA,
    valor AS ${p}_VALOR,
    CASE WHEN em_aberto = 1 THEN valor ELSE 0 END AS ${p}_SALDO,
    '1' AS ${p}_MOEDA,
    natureza_cod AS ${p}_NATUREZ,
    status_titulo AS ${p}_STATUS,
    CONVERT(char(10), dt_baixa, 23) AS ${p}_BAIXA,
    historico AS ${p}_HIST,
    natureza AS NATUREZA_DESCRICAO,
    natureza_tipo AS NATUREZA_TIPO,
    natureza_status AS NATUREZA_STATUS,
    natureza_balancete AS NATUREZA_BALANCETE,
    cd_lan AS SISLOC_CD_LAN,
    doc_num AS SISLOC_DOCUMENTO,
    ${isCap ? '' : 'empresa_cd AS SISLOC_EMPRESA,'}
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
    ${isCap ? 'COUNT(*)' : 'SUM(CASE WHEN empresa_cd IS NULL THEN 1 ELSE 0 END)'} AS sem_filial,
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