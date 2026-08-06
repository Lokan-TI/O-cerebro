// Documentação técnica das regras e consultas da análise de Conversão de Novos Clientes
export const CONVERSION_DOCS = {
  relacionamentos: [
    { de: "pessoa.cd_pessoa (int)", para: "fich_loc.cd_pessoa (int)", obs: "Chave validada: 1.388 de 1.739 novos cadastros com ficha correspondente. lookup_cd_pessoa é apenas campo de exibição." },
    { de: "pessoa.cd_pessoa (int)", para: "nf.cd_pessoa (int)", obs: "Nota fiscal ligada diretamente ao cliente; nf.cd_pessoa_fun é o emissor (back-office), não o vendedor." },
    { de: "fich_loc.cd_pessoa_fun", para: "pessoa.cd_pessoa", obs: "Vendedor responsável pela primeira ficha — usado na análise de aquisição." },
    { de: "fich_loc.cd_empresa / nf.cd_empresa", para: "empresa.cd_empresa", obs: "Filial de origem." },
  ],
  regras: [
    { titulo: "Novo cadastro", texto: "pessoa.dt_cad_pessoa dentro do período selecionado. O período corrente é calculado dinamicamente na execução." },
    { titulo: "Confirmação de cliente", texto: "Apenas pessoa.fl_cliente_pessoa = 1 entra nos KPIs. Fornecedores, funcionários e demais cadastros ficam como TIPO DE PESSOA NÃO CONFIRMADO." },
    { titulo: "Ficha válida", texto: "Registro em fich_loc com dt_pedido preenchida. Fichas encerradas contam como conversão (dt_enc_ficha apenas classifica ativas x encerradas)." },
    { titulo: "Nota válida", texto: "nf com dt_emi_nf preenchida e fl_can_nf <> 'S'. Notas canceladas somam apenas no status NOTA FISCAL CANCELADA." },
    { titulo: "Contagem única", texto: "Cada cliente é contado uma única vez por etapa; faturamento é somado separadamente." },
    { titulo: "Coorte", texto: "O cliente permanece no mês do cadastro, mesmo que converta meses depois. O mês corrente é sinalizado como MÊS EM ANDAMENTO." },
    { titulo: "Identificação global", texto: "Identificador composto por FONTE-ID (ex.: MATRIZ-15248) para evitar colisão entre bancos de filiais." },
    { titulo: "Duplicidade", texto: "Agrupamento por CPF/CNPJ apenas. Nomes semelhantes não consolidam registros." },
    { titulo: "Inconsistências", texto: "Ficha ou nota anterior ao cadastro, datas futuras ou nulas — mantidas na base e classificadas como DADOS INCONSISTENTES." },
  ],
  queries: [
    {
      nome: "Coorte de novos clientes",
      sql: `SELECT p.cd_pessoa, p.nm_pessoa, p.fl_tipo_pessoa, p.nr_cpf_pessoa, p.nr_cnpj_pessoa,
       p.dt_cad_pessoa, p.fl_cliente_pessoa, p.fl_ativo
FROM pessoa p WITH (NOLOCK)
WHERE p.dt_cad_pessoa >= @inicio AND p.dt_cad_pessoa < @fim`,
    },
    {
      nome: "Primeira ficha de locação por cliente",
      sql: `SELECT cd_pessoa, dt_pedido, cd_controle, cd_empresa, cd_pessoa_fun, qtd, ativas FROM (
  SELECT f.cd_pessoa, f.dt_pedido, f.cd_controle, f.cd_empresa, f.cd_pessoa_fun,
    COUNT(*) OVER (PARTITION BY f.cd_pessoa) AS qtd,
    SUM(CASE WHEN f.dt_enc_ficha IS NULL THEN 1 ELSE 0 END) OVER (PARTITION BY f.cd_pessoa) AS ativas,
    ROW_NUMBER() OVER (PARTITION BY f.cd_pessoa ORDER BY f.dt_pedido, f.cd_controle) AS rn
  FROM fich_loc f WITH (NOLOCK)
  WHERE f.cd_pessoa IN (@coorte) AND f.dt_pedido IS NOT NULL
) x WHERE rn = 1`,
    },
    {
      nome: "Primeira nota fiscal e faturamento por cliente",
      sql: `SELECT cd_pessoa, dt_emi_nf, nr_nf, cd_empresa, vl_primeira, vl_total, qtd FROM (
  SELECT n.cd_pessoa, n.dt_emi_nf, n.nr_nf_ini AS nr_nf, n.cd_empresa,
    n.vl_faturamento AS vl_primeira,
    SUM(ISNULL(n.vl_faturamento,0)) OVER (PARTITION BY n.cd_pessoa) AS vl_total,
    COUNT(*) OVER (PARTITION BY n.cd_pessoa) AS qtd,
    ROW_NUMBER() OVER (PARTITION BY n.cd_pessoa ORDER BY n.dt_emi_nf, n.nr_nf_ini) AS rn
  FROM nf n WITH (NOLOCK)
  WHERE n.cd_pessoa IN (@coorte) AND n.dt_emi_nf IS NOT NULL
    AND ISNULL(n.fl_can_nf,'N') <> 'S'
) x WHERE rn = 1`,
    },
    {
      nome: "Notas canceladas por cliente",
      sql: `SELECT n.cd_pessoa, COUNT(*) AS qtd
FROM nf n WITH (NOLOCK)
WHERE n.cd_pessoa IN (@coorte) AND n.fl_can_nf = 'S'
GROUP BY n.cd_pessoa`,
    },
    {
      nome: "Funil consolidado (conferência)",
      sql: `SELECT
  (SELECT COUNT(*) FROM pessoa WITH (NOLOCK)
     WHERE dt_cad_pessoa >= @inicio AND dt_cad_pessoa < @fim AND fl_cliente_pessoa = 1) AS novos_cadastros,
  (SELECT COUNT(DISTINCT f.cd_pessoa) FROM fich_loc f WITH (NOLOCK)
     WHERE f.cd_pessoa IN (@coorte)) AS com_ficha,
  (SELECT COUNT(DISTINCT n.cd_pessoa) FROM nf n WITH (NOLOCK)
     WHERE n.cd_pessoa IN (@coorte) AND ISNULL(n.fl_can_nf,'N') <> 'S') AS com_nota_fiscal`,
    },
  ],
  limitacoes: [
    "Tipo de produto da primeira ficha não está incluído nesta versão — exige varredura dos itens da ficha, que hoje estoura o timeout do wrapper DW_API.",
    "Vendedor considerado é o da primeira ficha de locação (regra de aquisição). O cadastro da pessoa não possui vendedor vinculado no schema desta base.",
    "A tabela detalhada é publicada com até 2.000 clientes por versão, ordenados por data de cadastro decrescente.",
  ],
};