// Catálogo de colunas e montador de SQL para exportação de CAP (Contas a Pagar)
// e CAR (Contas a Receber) do Sisloc — fonte: v_Dicionario_Dados (dicionário oficial).
// Toda coluna exportável está listada aqui (whitelist): nada fora do catálogo entra no SQL.

// ── Colunas da tabela base ──────────────────────────────────────────────────
export const CAR_BASE_COLUMNS = [
  ['cd_lan', 'ID do lançamento'], ['id_row', 'Sequencial interno'],
  ['tp_car', 'Tipo'], ['fl_status', 'Status'],
  ['dt_emi_car', 'Emissão'], ['dt_ven_car', 'Vencimento'], ['dt_bai_car', 'Baixa'],
  ['dt_cancelamento', 'Dt. cancelamento'], ['dt_conciliacao', 'Dt. conciliação'],
  ['dt_venori_car', 'Vencimento doc. origem'], ['dt_mov', 'Última alteração'],
  ['vl_pre_car', 'Valor previsto'], ['vl_acr_car', 'Acréscimo'], ['vl_des_car', 'Desconto'],
  ['vl_juros', 'Juros'], ['vl_multa', 'Multa'], ['vl_despesa', 'Despesas'],
  ['vl_totdoc_ori', 'Valor doc. origem'],
  ['vl_juros_renegociacao', 'Juros renegociação'], ['vl_multa_renegociacao', 'Multa renegociação'],
  ['vl_desconto_renegociacao', 'Desconto renegociação'],
  ['vl_retencao_ir', 'Retenção IR'], ['vl_retencao_iss', 'Retenção ISS'],
  ['vl_retencao_inss', 'Retenção INSS'], ['vl_retencao_pis', 'Retenção PIS'],
  ['vl_retencao_cofins', 'Retenção COFINS'], ['vl_retencao_csll', 'Retenção CSLL'],
  ['cd_pessoa_cli', 'Cliente (código)'], ['cd_pessoa_sac', 'Sacado (código)'],
  ['cd_pessoa_ven', 'Vendedor (código)'],
  ['cd_empresa_gestora', 'Empresa gestora (código)'], ['cd_conta', 'Conta (código)'],
  ['cd_tipocob', 'Tipo cobrança (código)'], ['cd_status_cobr', 'Status cobrança (código)'],
  ['cd_controle', 'Doc. origem (controle)'], ['cd_origem', 'NF que gerou (ID)'],
  ['nf_numero', 'Número da NF'], ['nf_valor_parcela', 'Valor parcela NF'],
  ['nf_valor_total', 'Valor total NF'],
  ['cd_fatura', 'ID duplicata'], ['cd_lan_dev', 'ID origem (devolução)'],
  ['cd_controle_dev', 'ID devolução'], ['cd_controle_adiantamento', 'ID adiantamento'],
  ['cd_cte_ori', 'CT-e'], ['cd_papelcontabil', 'Papel contábil'],
  ['cd_conta_original', 'Conta original'],
  ['cd_renegociacao_origem', 'Renegociação (simulação)'], ['cd_renegociacao_destino', 'Renegociação (efetivada)'],
  ['nr_docto_ori', 'Nº doc. origem'], ['ds_doc_ori', 'Descrição da origem'],
  ['ob_car', 'Histórico'], ['inf_origem_car', 'Informação origem'],
  ['nr_codbarras', 'Linha digitável'], ['cd_barras_api', 'Código barras API'],
  ['ds_autorizacaocartao', 'Autorização cartão'], ['nr_lote', 'Nº lote'],
  ['fl_adiantamento', 'Adiantamento (S/N)'], ['fl_descontado', 'CAR descontado'],
  ['fl_liq_compensar', 'Liquidado a compensar'], ['fl_pcld', 'PCLD'],
  ['fl_pic', 'Perdas incorridas'], ['fl_integr_bvs', 'Integração BVS'],
  ['fl_status_bvs', 'Status BVS'], ['dt_status_bvs', 'Data status BVS'],
  ['intelrisk', 'Integração IntelRisk'], ['codigo_importacao', 'Código importação'],
  ['upd_date_tipocob', 'Alteração tipo cobrança'],
  ['lad_ins_date', 'Incluído em'], ['lad_ins_user', 'Incluído por'],
  ['lad_upd_date', 'Alterado em'], ['lad_upd_user', 'Alterado por'],
];

export const CAP_BASE_COLUMNS = [
  ['cd_lan', 'ID do lançamento'], ['id_row', 'Sequencial interno'],
  ['tp_cap', 'Tipo'], ['fl_status', 'Status'], ['fl_status_titulo', 'Status CAP'],
  ['dt_emi_cap', 'Emissão'], ['dt_ven_cap', 'Vencimento'], ['dt_bai_cap', 'Baixa'],
  ['dt_conciliacao', 'Dt. conciliação'], ['dt_venori_cap', 'Vencimento origem'],
  ['dt_mov', 'Última alteração'], ['dt_agendpagto', 'Agendamento pagto'],
  ['vl_pre_cap', 'Valor previsto'], ['vl_acr_cap', 'Acréscimo'], ['vl_des_cap', 'Desconto'],
  ['vl_juros', 'Juros'], ['vl_amortizacao', 'Amortização'],
  ['vl_acr_contrato', 'Juros contrato'], ['vl_des_contrato', 'Desconto contrato'],
  ['vl_juros_renegociacao', 'Juros renegociação'], ['vl_multa_renegociacao', 'Multa renegociação'],
  ['vl_desconto_renegociacao', 'Desconto renegociação'],
  ['vl_retencao_ir', 'Retenção IRRF'], ['vl_retencao_iss', 'Retenção ISS'],
  ['vl_retencao_inss', 'Retenção INSS'], ['vl_retencao_pis', 'Retenção PIS'],
  ['vl_retencao_cofins', 'Retenção COFINS'], ['vl_retencao_csll', 'Retenção CSLL'],
  ['vl_retencao_pis_cap', 'A reter PIS'], ['vl_retencao_cofins_cap', 'A reter COFINS'],
  ['vl_retencao_csll_cap', 'A reter CSLL'],
  ['vl_base_pcc', 'Base PCC (aplicado)'], ['vl_base_pcc_cap', 'Base PCC (CAP)'],
  ['cd_pessoa_cre', 'Credor (código)'], ['cd_pessoa_cre_trib', 'Credor do tributo'],
  ['cd_conta', 'Conta (código)'], ['cd_tipocob', 'Tipo cobrança (código)'],
  ['cd_controle', 'Controle'], ['cd_origem', 'NF de origem (ID)'],
  ['cd_fatura', 'Cód. pagamento'], ['cd_borderopagto', 'Nº borderô pagto'],
  ['cd_controle_contrato', 'Contrato'], ['cd_controle_adiantamento', 'ID adiantamento'],
  ['cd_papelcontabil', 'Papel contábil'], ['cd_conta_original', 'Conta original'],
  ['cd_renegociacao_origem', 'Renegociação (simulação)'], ['cd_renegociacao_destino', 'Renegociação (efetivada)'],
  ['cd_origem_guia', 'Origem guia'],
  ['fr_pagto', 'Forma de pagto'], ['tp_pagto', 'Tipo de pagto'],
  ['nr_boleto', 'Nº boleto'], ['nr_che_cap', 'Nº cheque'],
  ['nr_pagto_banco', 'Nº pagto banco'], ['id_pgto', 'ID pagamento'],
  ['autenticacao_pagto', 'Autenticação pagto'],
  ['fl_autoriz', 'Autorizado'], ['dt_autorizacao', 'Dt. autorização pgto'],
  ['cd_usuario_aut', 'Autorizado por (código)'], ['nm_naoautoriz', 'Não autorizado por'],
  ['ds_motivonaoautoriz', 'Motivo não autorização'],
  ['dt_autoriz_dupl', 'Dt. autorização duplicado'], ['cd_usuario_dupl', 'Autorização duplicado (usuário)'],
  ['fl_adiantamento', 'Adiantamento (S/N)'], ['fl_liq_compensar', 'Liquidado a compensar'],
  ['fl_antecipacaocontrato', 'Antecipação contrato'], ['nr_lote', 'Nº lote'],
  ['ob_cap', 'Histórico'],
  ['lad_ins_date', 'Incluído em'], ['lad_ins_user', 'Incluído por'],
  ['lad_upd_date', 'Alterado em'], ['lad_upd_user', 'Alterado por'],
];

// ── Colunas de tabelas relacionadas (via FK do dicionário) ─────────────────
// expr usa os aliases dos joins declarados abaixo.
export const CAR_RELATED_COLUMNS = [
  ['rel_cliente_nome', 'Cliente — Nome', "COALESCE(NULLIF(pcli.nm_fan_pessoa,''), pcli.nm_pessoa)", 'cliente'],
  ['rel_cliente_razao', 'Cliente — Razão social', 'pcli.nm_pessoa', 'cliente'],
  ['rel_cliente_cnpj', 'Cliente — CNPJ', 'pcli.nr_cnpj_pessoa', 'cliente'],
  ['rel_cliente_cpf', 'Cliente — CPF', 'pcli.nr_cpf_pessoa', 'cliente'],
  ['rel_sacado_nome', 'Sacado — Nome', "COALESCE(NULLIF(psac.nm_fan_pessoa,''), psac.nm_pessoa)", 'sacado'],
  ['rel_vendedor_nome', 'Vendedor — Nome', "COALESCE(NULLIF(pven.nm_fan_pessoa,''), pven.nm_pessoa)", 'vendedor'],
  ['rel_empresa_nome', 'Empresa gestora — Nome', 'emp.nm_fan_empresa', 'empresa'],
  ['rel_conta_numero', 'Natureza financeira — Numeração', 'pl.nr_planfin', 'plano'],
  ['rel_conta_descricao', 'Natureza financeira — Descrição', 'pl.ds_planfin', 'plano'],
  ['rel_tipo_cobranca', 'Tipo de cobrança — Descrição', 'tc.ds_tipocob', 'tpcob'],
];

export const CAP_RELATED_COLUMNS = [
  ['rel_credor_nome', 'Credor — Nome', "COALESCE(NULLIF(pcre.nm_fan_pessoa,''), pcre.nm_pessoa)", 'credor'],
  ['rel_credor_razao', 'Credor — Razão social', 'pcre.nm_pessoa', 'credor'],
  ['rel_credor_cnpj', 'Credor — CNPJ', 'pcre.nr_cnpj_pessoa', 'credor'],
  ['rel_credor_cpf', 'Credor — CPF', 'pcre.nr_cpf_pessoa', 'credor'],
  ['rel_conta_numero', 'Natureza financeira — Numeração', 'pl.nr_planfin', 'plano'],
  ['rel_conta_descricao', 'Natureza financeira — Descrição', 'pl.ds_planfin', 'plano'],
  ['rel_tipo_cobranca', 'Tipo de cobrança — Descrição', 'tc.ds_tipocob', 'tpcob'],
];

const JOINS = {
  cliente: 'LEFT JOIN pessoa pcli WITH (NOLOCK) ON pcli.cd_pessoa = c.cd_pessoa_cli',
  sacado: 'LEFT JOIN pessoa psac WITH (NOLOCK) ON psac.cd_pessoa = c.cd_pessoa_sac',
  vendedor: 'LEFT JOIN pessoa pven WITH (NOLOCK) ON pven.cd_pessoa = c.cd_pessoa_ven',
  credor: 'LEFT JOIN pessoa pcre WITH (NOLOCK) ON pcre.cd_pessoa = c.cd_pessoa_cre',
  empresa: 'LEFT JOIN empresa emp WITH (NOLOCK) ON emp.cd_empresa = c.cd_empresa_gestora',
  plano: 'LEFT JOIN plano pl WITH (NOLOCK) ON pl.cd_planfin = c.cd_conta',
  tpcob: 'LEFT JOIN tpcobranca tc WITH (NOLOCK) ON tc.cd_tipocob = c.cd_tipocob',
};

export function getCatalog(doc) {
  const base = doc === 'cap' ? CAP_BASE_COLUMNS : CAR_BASE_COLUMNS;
  const related = doc === 'cap' ? CAP_RELATED_COLUMNS : CAR_RELATED_COLUMNS;
  return {
    base: base.map(([id, label]) => ({ id, label })),
    related: related.map(([id, label]) => ({ id, label })),
  };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Monta o SELECT de exportação. Tudo validado contra o catálogo (whitelist).
export function buildExportSql({ doc, columns, startDate, endDate, status, cdEmpresa, limit }) {
  const isCap = doc === 'cap';
  const base = new Map(isCap ? CAP_BASE_COLUMNS : CAR_BASE_COLUMNS);
  const related = new Map((isCap ? CAP_RELATED_COLUMNS : CAR_RELATED_COLUMNS).map(([id, _label, expr, join]) => [id, { expr, join }]));

  const selectParts = [];
  const joinsNeeded = new Set();
  for (const col of columns) {
    if (base.has(col)) {
      selectParts.push(`c.${col}`);
    } else if (related.has(col)) {
      const r = related.get(col);
      selectParts.push(`${r.expr} AS ${col}`);
      joinsNeeded.add(r.join);
    } else {
      throw new Error(`Coluna não permitida: ${col}`);
    }
  }
  if (selectParts.length === 0) throw new Error('Selecione ao menos uma coluna.');
  if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) throw new Error('Período inválido.');

  const emi = isCap ? 'dt_emi_cap' : 'dt_emi_car';
  const bai = isCap ? 'dt_bai_cap' : 'dt_bai_car';
  const ven = isCap ? 'dt_ven_cap' : 'dt_ven_car';

  const where = [`c.${emi} >= '${startDate}' AND c.${emi} < DATEADD(day, 1, CAST('${endDate}' AS date))`];
  const cancel = isCap ? '' : ' AND c.dt_cancelamento IS NULL';
  if (status === 'aberto') where.push(`c.${bai} IS NULL${cancel}`);
  else if (status === 'baixado') where.push(`c.${bai} IS NOT NULL`);
  else if (status === 'vencido') where.push(`c.${ven} < GETDATE() AND c.${bai} IS NULL${cancel}`);
  else if (status === 'cancelado' && !isCap) where.push('c.dt_cancelamento IS NOT NULL');

  if (!isCap && cdEmpresa != null && cdEmpresa !== '') {
    const n = Number(cdEmpresa);
    if (!Number.isFinite(n)) throw new Error('Empresa inválida.');
    where.push(`c.cd_empresa_gestora = ${n}`);
  }

  const top = Math.min(Math.max(Number(limit) || 5000, 1), 10000);
  const table = isCap ? 'cap' : 'car';
  const joinSql = [...joinsNeeded].map((j) => JOINS[j]).join('\n  ');

  return `SELECT TOP ${top} ${selectParts.join(', ')}
  FROM ${table} c WITH (NOLOCK)
  ${joinSql}
  WHERE ${where.join(' AND ')}
  ORDER BY c.${emi} DESC`;
}