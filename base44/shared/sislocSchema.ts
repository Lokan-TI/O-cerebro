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

export const SISLOC_SCHEMA_VERSION = '1.1';

// Níveis de evidência. A estrutura física vem do v_Dicionario_Dados; comportamento de
// relatório vem de SQL capturado do próprio Sisloc. Semântica de negócio só é promovida
// depois de reconciliação/aceite — nunca inferir significado apenas pelo nome da coluna.
export const SISLOC_EVIDENCE = {
  DICTIONARY_CONFIRMED: 'DICTIONARY_CONFIRMED',
  ERP_LOG_CONFIRMED: 'ERP_LOG_CONFIRMED',
  SEMANTIC_PENDING: 'SEMANTIC_PENDING',
} as const;

// View observada no SQL nativo do relatório de Receita por Grupo em 25/08/2026.
// Ela NÃO está catalogada no MetadataCatalog/v_Dicionario_Dados atual, portanto fica fora
// do validador automático SISLOC_TABLES até termos descoberta de views. Não substituir por
// `nf.dt_emissao`: o campo físico confirmado da tabela nf é `dt_emi_nf`.
export const SISLOC_REPORT_VIEWS = [
  {
    name: 'v_nf_emissao',
    object_type: 'view',
    evidence: SISLOC_EVIDENCE.ERP_LOG_CONFIRMED,
    dictionary_status: 'NOT_CATALOGUED',
    purpose: 'View usada pelo Sisloc como dimensão de emissão no relatório Receita por Grupo.',
    join: 'v_nf_emissao.cd_nf = nf.cd_nf',
    columns_observed: ['cd_nf', 'dt_emissao'],
  },
];

// Guardrails físicos para impedir aliases inventados e mistura de conceitos.
export const SISLOC_PHYSICAL_GUARDRAILS = {
  nf_emission_date: 'nf.dt_emi_nf',
  revenue_group_emission_date: 'v_nf_emissao.dt_emissao',
  invoice_synthetic_amount: 'nf.vl_faturamento',
  revenue_group_allocation_amount: 'nffatur.vl_nffatur',
  revenue_group_name: 'grupo.nm_grupo',
  revenue_group_key: 'grupo.cd_grupo',
  equipment_family_key: 'equipto.cd_equfamilia',
} as const;

// Dependências físicas observadas no SQL nativo do relatório Receita por Grupo.
// Não entram no loop genérico de compatibilidade para não transformar um relatório
// específico em requisito de toda implantação Sisloc. A validação especializada será
// feita pelo contrato do relatório.
export const SISLOC_REVENUE_GROUP_OBJECTS = [
  { name: 'nffatur', fields: ['cd_nf', 'dt_ven_nffatur', 'vl_bruto', 'vl_nffatur'] },
  { name: 'fl_fat_equ', fields: ['cd_flfatura', 'cd_equipto', 'cd_patrimonio', 'quantidade', 'vl_unitario'] },
  { name: 'fl_fat_comp', fields: ['cd_flfatura', 'cd_composicao', 'quantidade', 'vl_unitario'] },
  { name: 'fl_fat_medidor', fields: ['cd_flfatura', 'cd_patrimonio', 'vl_total'] },
  { name: 'fl_apontamento_fatura', fields: ['cd_flfatura', 'cd_equipto', 'vl_tot_cobranca'] },
  { name: 'loc_fichloc_apont_apontamento', fields: ['cd_flfatura', 'vl_tot_hora_normal', 'vl_tot_hora_excedente', 'vl_tot_mob', 'vl_tot_desmob', 'vl_tot_acrescimo', 'vl_tot_desconto'] },
  { name: 'ped_ven', fields: ['cd_controle', 'cd_nf_pedven', 'dt_ger_fatura', 'vl_fre_pedven', 'vl_des_pedven', 'vl_dea_pedven', 'vl_ipi_pedven', 'vl_icms_st', 'vl_seg_pedven'] },
  { name: 'pev_xequ', fields: ['cd_controle', 'cd_equipto', 'qt_pevxequ', 'vl_uni_pevxequ'] },
  { name: 'orcos', fields: ['cd_equipto', 'cd_nf_fat', 'cd_nf_fat_ven', 'dt_faturamento', 'vl_venda_material', 'vl_venda_servico'] },
  { name: 'fichloc_servico', fields: ['cd_controle', 'cd_flfatura', 'cd_servico', 'cd_fldevolucao', 'vl_total'] },
  { name: 'servico', fields: ['cd_servico', 'cd_grupo'] },
  { name: 'fl_devolucao', fields: ['cd_fldevolucao', 'cd_controle', 'cd_nf', 'fl_operacao'] },
  { name: 'fl_dev_equ', fields: ['cd_fldevolucao', 'cd_flremequ', 'qt_devolucao', 'vl_uni_indenizacao'] },
  { name: 'fl_rem_equ', fields: ['cd_flremequ', 'cd_flremessa', 'cd_equipto', 'cd_patrimonio', 'qt_remessa', 'qt_devolucao', 'vl_uni_indenizacao'] },
  { name: 'equipto', fields: ['cd_equipto', 'nm_equipto', 'cd_grupo', 'cd_equfamilia'] },
  { name: 'grupo', fields: ['cd_grupo', 'nm_grupo'] },
  { name: 'composicao', fields: ['cd_composicao', 'ds_composicao', 'cd_grupo'] },
  { name: 'patrimon', fields: ['cd_patrimonio', 'nr_patrimonio', 'cd_equipto'] },
] as const;

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
      { name: 'cd_flfatura', required: true, purpose: 'Chave da fatura de locação' },
      { name: 'cd_controle', required: true, purpose: 'Vínculo à ficha' },
      { name: 'cd_nf', required: false, purpose: 'Vínculo à NF quando emitida' },
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
      { name: 'cd_pessoa', required: true, purpose: 'Cliente da NF' },
      { name: 'cd_pessoa_fun', required: false, purpose: 'Pessoa/funcionário da NF; papel de negócio permanece SEMANTIC_PENDING' },
      { name: 'dt_emi_nf', required: true, purpose: 'Data física de emissão da tabela nf' },
      { name: 'vl_faturamento', required: true, purpose: 'Valor faturamento sintético da NF; não equivale por si só a Receita por Grupo' },
      { name: 'fl_ent_sai', required: false, purpose: 'Entrada / Saída' },
      { name: 'fl_can_nf', required: false, purpose: 'Flag de cancelamento' },
      { name: 'dt_cancelamento', required: false, purpose: 'Data de cancelamento' },
      { name: 'dt_anul_nf', required: false, purpose: 'Data de anulação' },
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
    name: 'mkt_orcamento', layer: 'fato', target: 'fato_orcamentos', required: false,
    purpose: 'Orçamentos comerciais. Datas físicas distintas para abertura, emissão, aprovação e cancelamento.',
    columns: [
      { name: 'cd_controle', required: true, purpose: 'Chave do orçamento' },
      { name: 'cd_empresa', required: true, purpose: 'Empresa' },
      { name: 'cd_pessoa_cli', required: true, purpose: 'Cliente' },
      { name: 'cd_pessoa_fun', required: false, purpose: 'Vendedor conforme caption do ERP; validar semântica por KPI' },
      { name: 'dt_orcamento', required: true, purpose: 'Data de abertura do orçamento' },
      { name: 'dt_emissao', required: false, purpose: 'Data de emissão do orçamento' },
      { name: 'dt_aprovacao', required: false, purpose: 'Data de aprovação' },
      { name: 'dt_cancelamento', required: false, purpose: 'Data de cancelamento' },
    ],
  },
  {
    name: 'nffatur', layer: 'financeiro', target: 'fato_rateio_nf', required: false,
    purpose: 'Parcelamento/faturamento financeiro da NF; usado pelo relatório nativo Receita por Grupo.',
    columns: [
      { name: 'cd_nf', required: true, purpose: 'Vínculo à NF' },
      { name: 'dt_ven_nffatur', required: false, purpose: 'Vencimento' },
      { name: 'vl_bruto', required: false, purpose: 'Valor bruto' },
      { name: 'vl_nffatur', required: true, purpose: 'Valor líquido usado no rateio observado no relatório Receita por Grupo' },
    ],
  },
  {
    name: 'financas_car_comissao', layer: 'fato', target: 'fato_comissao', required: false,
    purpose: 'Comissão por NF — identifica a pessoa comissionada. O papel semântico "vendedor" deve ser declarado por KPI, não inferido globalmente.',
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
  { origem: 'mkt_orcamento', destino: 'fato_orcamentos' },
  { origem: 'nffatur', destino: 'fato_rateio_nf' },
  { origem: 'car', destino: 'fato_contas_receber' },
  { origem: 'cap', destino: 'fato_contas_pagar' },
  { origem: 'financas_car_comissao', destino: 'fato_comissao' },
  { origem: 'plano', destino: 'dim_plano_financeiro' },
  { origem: 'est_mov', destino: 'fato_movimentacoes_est' },
];