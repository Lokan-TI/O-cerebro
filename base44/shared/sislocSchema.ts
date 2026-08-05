// Schema Canônico Sisloc — contrato único reutilizado por toda nova base conectada.
// A validação (validateSislocSchema) compara cada nova fonte contra este contrato e
// classifica em: Compatível / Compatível com alertas / Incompatível.
//
// Camadas analíticas (destino) conforme o modelo canônico:
//   dim_empresa, dim_cliente, fato_fichas, fato_movimentacoes, fato_receita,
//   fato_contas_receber, fato_contas_pagar, fato_comissao, dim_plano_financeiro.
//
// Toda tabela fato/carrega cd_empresa; cliente vem via pessoa (cd_pessoa). A unidade
// operacional no Sisloc É a própria empresa (matriz + filiais são cd_empresa distintos),
// por isso a dimensão empresa é também a dimensão filial neste ERP.

export const SISLOC_SCHEMA_VERSION = '1.0';

// required=true → ausência torna a base Incompatível e bloqueia publicação na camada analítica.
// required=false → ausência gera alerta; integração permitida com dashboards parciais.
export const SISLOC_TABLES = [
  {
    name: 'empresa', layer: 'dim', target: 'dim_empresa', required: true,
    purpose: 'Dimensão empresa/unidade (matriz e filiais). Pivot analítico principal.',
    columns: [
      { name: 'cd_empresa', required: true, purpose: 'Chave da empresa' },
      { name: 'nm_fan_empresa', required: true, purpose: 'Nome fantasia' },
      { name: 'nm_razsoc_empresa', required: false, purpose: 'Razão social' },
    ],
  },
  {
    name: 'pessoa', layer: 'dim', target: 'dim_cliente', required: true,
    purpose: 'Dimensão cliente/fornecedor/pessoa.',
    columns: [
      { name: 'cd_pessoa', required: true, purpose: 'Chave da pessoa' },
      { name: 'nm_pessoa', required: true, purpose: 'Nome' },
      { name: 'nm_fan_pessoa', required: false, purpose: 'Nome fantasia' },
      { name: 'fl_tipo_pessoa', required: false, purpose: 'Física/Jurídica' },
      { name: 'nr_cpf_pessoa', required: false, purpose: 'CPF' },
      { name: 'nr_cnpj_pessoa', required: false, purpose: 'CNPJ' },
      { name: 'dt_cad_pessoa', required: false, purpose: 'Data de cadastro' },
    ],
  },
  {
    name: 'fich_loc', layer: 'fato', target: 'fato_fichas', required: true,
    purpose: 'Fichas de locação / contratos.',
    columns: [
      { name: 'cd_controle', required: true, purpose: 'Chave da ficha' },
      { name: 'cd_pessoa', required: true, purpose: 'Cliente' },
      { name: 'cd_empresa', required: true, purpose: 'Empresa' },
      { name: 'dt_pedido', required: true, purpose: 'Data do pedido' },
      { name: 'fl_baixada', required: false, purpose: 'Flag baixada' },
      { name: 'dt_enc_ficha', required: false, purpose: 'Encerramento' },
      { name: 'vl_minimo_locacao', required: false, purpose: 'Valor mínimo' },
      { name: 'vl_encerramento', required: false, purpose: 'Valor de encerramento' },
    ],
  },
  {
    name: 'fl_remessa', layer: 'movimento', target: 'fato_movimentacoes', required: true,
    purpose: 'Remessas realizadas — cliente ativo = dt_saida preenchida e não cancelada.',
    columns: [
      { name: 'cd_flremessa', required: true, purpose: 'Chave da remessa' },
      { name: 'cd_controle', required: true, purpose: 'Vínculo à ficha' },
      { name: 'dt_saida', required: true, purpose: 'Data de realização (cliente ativo)' },
      { name: 'fl_rem_cancelada', required: false, purpose: 'Cancelamento' },
    ],
  },
  {
    name: 'fl_fatura', layer: 'fato', target: 'fato_receita', required: true,
    purpose: 'Pré-faturamento — receita gerada por ficha.',
    columns: [
      { name: 'cd_controle', required: true, purpose: 'Vínculo à ficha' },
      { name: 'vl_fatura', required: true, purpose: 'Valor da fatura' },
      { name: 'dt_geracao', required: true, purpose: 'Data de geração' },
    ],
  },
  {
    name: 'nf', layer: 'fato', target: 'fato_receita', required: true,
    purpose: 'Notas fiscais — receita realizada/faturada.',
    columns: [
      { name: 'cd_nf', required: true, purpose: 'Chave da NF' },
      { name: 'cd_empresa', required: true, purpose: 'Empresa' },
      { name: 'cd_pessoa', required: true, purpose: 'Cliente' },
      { name: 'dt_emi_nf', required: true, purpose: 'Data de emissão' },
      { name: 'vl_faturamento', required: true, purpose: 'Valor faturado' },
      { name: 'fl_can_nf', required: false, purpose: 'Flag de cancelamento' },
      { name: 'uf_destinatario', required: false, purpose: 'UF (distribuição geográfica)' },
    ],
  },
  {
    name: 'car', layer: 'financeiro', target: 'fato_contas_receber', required: true,
    purpose: 'Contas a receber.',
    columns: [
      { name: 'cd_pessoa_cli', required: true, purpose: 'Cliente' },
      { name: 'cd_empresa_gestora', required: true, purpose: 'Empresa gestora' },
      { name: 'vl_pre_car', required: true, purpose: 'Valor do título' },
      { name: 'dt_emi_car', required: true, purpose: 'Emissão' },
      { name: 'dt_ven_car', required: true, purpose: 'Vencimento' },
      { name: 'dt_bai_car', required: false, purpose: 'Baixa' },
      { name: 'dt_cancelamento', required: false, purpose: 'Cancelamento' },
    ],
  },
  {
    name: 'cap', layer: 'financeiro', target: 'fato_contas_pagar', required: true,
    purpose: 'Contas a pagar.',
    columns: [
      { name: 'cd_conta', required: true, purpose: 'Conta/categoria' },
      { name: 'vl_pre_cap', required: true, purpose: 'Valor do título' },
      { name: 'dt_emi_cap', required: true, purpose: 'Emissão' },
      { name: 'dt_ven_cap', required: true, purpose: 'Vencimento' },
      { name: 'dt_bai_cap', required: false, purpose: 'Baixa' },
    ],
  },
  // ── Opcionais ──
  {
    name: 'financas_car_comissao', layer: 'fato', target: 'fato_comissao', required: false,
    purpose: 'Comissão por NF — identifica o vendedor real (não o emissor da NF).',
    columns: [
      { name: 'cd_nf', required: true, purpose: 'Vínculo à NF' },
      { name: 'cd_pessoa', required: true, purpose: 'Vendedor' },
      { name: 'vl_base_comissao', required: true, purpose: 'Base de comissão' },
    ],
  },
  {
    name: 'plano', layer: 'dim', target: 'dim_plano_financeiro', required: false,
    purpose: 'Plano financeiro — balancete analítico de contas a pagar.',
    columns: [
      { name: 'cd_planfin', required: true, purpose: 'Chave do plano' },
      { name: 'nr_planfin', required: true, purpose: 'Número' },
      { name: 'ds_planfin', required: true, purpose: 'Descrição' },
    ],
  },
  {
    name: 'est_mov', layer: 'movimento', target: 'fato_movimentacoes_est', required: false,
    purpose: 'Movimentação de estoque por operação.',
    columns: [
      { name: 'cd_movoperacao', required: true, purpose: 'Operação' },
      { name: 'cd_controle', required: false, purpose: 'Vínculo à ficha' },
      { name: 'dt_geracao', required: true, purpose: 'Data de geração' },
    ],
  },
];

export const SISLOC_ANALYTICAL_MAP = [
  { origem: 'empresa', destino: 'dim_empresa' },
  { origem: 'pessoa', destino: 'dim_cliente' },
  { origem: 'fich_loc', destino: 'fato_fichas' },
  { origem: 'fl_remessa', destino: 'fato_movimentacoes' },
  { origem: 'fl_fatura', destino: 'fato_receita' },
  { origem: 'nf', destino: 'fato_receita' },
  { origem: 'car', destino: 'fato_contas_receber' },
  { origem: 'cap', destino: 'fato_contas_pagar' },
  { origem: 'financas_car_comissao', destino: 'fato_comissao' },
  { origem: 'plano', destino: 'dim_plano_financeiro' },
  { origem: 'est_mov', destino: 'fato_movimentacoes_est' },
];