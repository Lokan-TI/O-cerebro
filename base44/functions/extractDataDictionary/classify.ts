// Classificação de domínio / semântica do dicionário de dados (Fase 3).

const DOMAIN_MAP: Record<string, string[]> = {
  FINANCIAL: ['nf', 'car', 'cap', 'plano', 'financas_car_comissao', 'lan', 'lan_xcr', 'financas_centrocusto', 'financas_rateiocentrocusto', 'financas_rateiocentrocustodetalhe', 'arq_equifax', 'car_serasa_mov', 'car_serasa_cnpj', 'car_integrbvs', 'cap_borderopagto_xdda', 'cap_darf', 'cap_impauto'],
  FLEET: ['patrimon', 'equipto', 'frota_multa'],
  CUSTOMER: ['pessoa', 'contatos', 'cad_pessoa_xsituacao', 'acesso_usuario_xcnpj_cli'],
  BRANCH: ['empresa', 'cad_empresacc', 'ger_inf_gerais', 'municipio'],
  INVOICING: ['nf_cte', 'nf_mdfe', 'nfserie', 'nf_retirada', 'nf_nfdownloadxml', 'nf_ctedownloadxml', 'nf_mdfe_contratante', 'nf_formapagto_grupocartao', 'cartacorrecao', 'cte_cartacorrecao', 'nf_reinf_r1000', 'nf_reinf_r2099'],
  LOGISTICS: ['fl_remessa', 'loc_apropriacao_item', 'loc_os_transporte', 'obra'],
  COMMERCIAL: ['mkt_orcamento', 'orcos', 'ped_ven', 'gers_cenariovisao'],
  INVENTORY: ['est_mov', 'est_movitem', 'est_etiqueta_config', 'est_etiqueta_imprimir'],
};

const CORE_TABLES = ['nf', 'pessoa', 'car', 'cap', 'patrimon', 'empresa', 'plano', 'fl_remessa', 'est_mov', 'est_movitem', 'mkt_orcamento', 'financas_car_comissao'];

const PII_TOKENS = ['cpf', 'cnpj', 'senha', 'password', 'token', 'rg', 'email', 'telefone', 'celular'];

export function classifyDomain(table: string) {
  const t = String(table || '').toLowerCase();
  for (const [domain, tables] of Object.entries(DOMAIN_MAP)) {
    if (tables.includes(t)) return domain;
  }
  return 'OTHER';
}

export function isCoreTable(table: string) {
  return CORE_TABLES.includes(String(table || '').toLowerCase());
}

export function isPii(column: string) {
  const c = String(column || '').toLowerCase();
  return PII_TOKENS.some((tok) => c.includes(tok));
}

export function classifySemanticType(column: string) {
  const c = String(column || '').toLowerCase();
  if (['cpf', 'cnpj', 'rg', 'documento'].some((t) => c.includes(t))) return 'DOCUMENT';
  if (c.startsWith('vl_') || c.startsWith('valor_') || c.startsWith('preco_')) return 'MONEY';
  if (c.startsWith('dt_') || c.startsWith('data_')) return 'DATE';
  if (['perc', 'pct', 'taxa', 'rate'].some((t) => c.includes(t))) return 'PERCENTAGE';
  if (['qtd', 'qt_', 'quantidade', 'count'].some((t) => c.includes(t))) return 'QUANTITY';
  if (c.startsWith('fl_') || c.startsWith('status') || c.startsWith('situacao')) return 'STATUS';
  if (c.startsWith('is_') || c.startsWith('tem_') || c === 'sn' || c.startsWith('sn_')) return 'BOOLEAN';
  if (c.startsWith('cd_') || c.startsWith('nr_') || c.startsWith('id_') || c.startsWith('cod_')) return 'IDENTIFIER';
  if (c.startsWith('ds_') || c.startsWith('desc') || c.startsWith('nm_') || c.startsWith('nome') || c.startsWith('descricao')) return 'DESCRIPTION';
  return 'OTHER';
}