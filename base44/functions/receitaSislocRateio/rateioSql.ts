// Reprodução do relatório SISLOC TGersReceitaGrupoList, variante capturada em 25/08/2026.
// Contrato desta implementação:
//   - tipo_periodo = 1 (data de emissão fiscal: v_nf_emissao.dt_emissao)
//   - janela SQL meio-aberta [startDate, endDateExclusive)
//   - empresas EXATAMENTE como o relatório capturado no SISLOC
//   - valor financeiro rateado = nffatur.vl_nffatur (nunca vl_bruto)
//
// O ERP executa cinco consultas independentes (locação, venda, manutenção, serviço e
// indenização) e depois consolida. Mantemos exatamente essa separação para permitir
// reconciliação por bloco, em vez de esconder diferenças dentro de uma CTE genérica.

export const SISLOC_REVENUE_REPORT_COMPANIES = [0, 4, 7, 8, 9, 11, 10, 13, 12, 6, 5] as const;
const SISLOC_REVENUE_REPORT_COMPANY_LIST = `(${SISLOC_REVENUE_REPORT_COMPANIES.join(',')})`;

function reportCompanyFilter(alias = 'e') {
  return `AND ${alias}.cd_empresa in ${SISLOC_REVENUE_REPORT_COMPANY_LIST}`;
}

export type RateioFilters = {
  startDate: string;
  endDateExclusive: string;
  groupId?: number;
  personId?: number;
  familyId?: number;
};

function n(v: number | undefined) {
  return Number.isFinite(Number(v)) ? Number(v) : 0;
}

function groupFilter(expr: string, groupId?: number) {
  const v = n(groupId);
  return v > 0 ? `AND ${expr} = ${v}` : '';
}

function personFilter(alias = 'pes', personId?: number) {
  const v = n(personId);
  return v > 0 ? `AND ${alias}.cd_pessoa = ${v}` : '';
}

function familyFilter(expr: string, familyId?: number) {
  const v = n(familyId);
  return v > 0 ? `AND ${expr} = ${v}` : '';
}

function onlyWhenAllFamilies(familyId?: number) {
  return n(familyId) > 0 ? 'AND 1 = 0' : '';
}

function onlyWhenAllGroups(groupId?: number) {
  return n(groupId) > 0 ? 'AND 1 = 0' : '';
}

function emissionWindow(alias: string, f: RateioFilters) {
  return `AND ${alias}.dt_emissao >= '${f.startDate}' AND ${alias}.dt_emissao < '${f.endDateExclusive}'`;
}

// 1) LOCAÇÃO — query principal do relatório. O UNION (não UNION ALL) é deliberado:
// é a mesma operação registrada no log do ERP entre os cinco subtipos.
export function locacaoSql(f: RateioFilters): string {
  const gfEquip = groupFilter('grupo.cd_grupo', f.groupId);
  const pf = personFilter('pes', f.personId);
  const ffEquip = familyFilter('equipto.cd_equfamilia', f.familyId);
  const onlyAllFamilies = onlyWhenAllFamilies(f.familyId);

  return `SELECT X.cd_grupo, X.nm_grupo, X.TIPO,
      X.nm_equipto AS nm_tipo, X.cd_equipto AS cd_tipo,
      X.cd_eq_pat, X.nm_eq_pat, SUM(X.valor) AS VALOR,
      X.nm_pessoa, X.categoria AS Categoria
    FROM (
      /* 1A · Equipamento faturado */
      SELECT grupo.cd_grupo, grupo.nm_grupo, 'E' AS TIPO,
        equipto.nm_equipto, equipto.cd_equipto,
        equipto.cd_equipto AS cd_eq_pat, '' AS nm_eq_pat,
        SUM(((fl_fat_equ.quantidade * fl_fat_equ.vl_unitario) / nf1.vl_faturamento) * nffatur.vl_nffatur) AS VALOR,
        pes.nm_pessoa, nf1.cd_nftotal AS Categoria
      FROM fl_fatura WITH (NOLOCK)
      INNER JOIN fl_fat_equ WITH (NOLOCK) ON fl_fatura.cd_flfatura = fl_fat_equ.cd_flfatura
      INNER JOIN equipto WITH (NOLOCK) ON fl_fat_equ.cd_equipto = equipto.cd_equipto
      INNER JOIN grupo WITH (NOLOCK) ON equipto.cd_grupo = grupo.cd_grupo
      INNER JOIN nf nf1 WITH (NOLOCK) ON fl_fatura.cd_nf = nf1.cd_nf
      INNER JOIN v_nf_emissao V WITH (NOLOCK) ON nf1.cd_nf = V.cd_nf
      INNER JOIN fich_loc e WITH (NOLOCK) ON fl_fatura.cd_controle = e.cd_controle
      LEFT OUTER JOIN nffatur WITH (NOLOCK) ON nffatur.cd_nf = nf1.cd_nf
      LEFT OUTER JOIN pessoa pes WITH (NOLOCK) ON pes.cd_pessoa = nf1.cd_pessoa_fun
      WHERE nf1.vl_faturamento > 0
        ${emissionWindow('V', f)}
        ${reportCompanyFilter('e')}
        ${gfEquip}
        ${pf}
        ${ffEquip}
      GROUP BY grupo.cd_grupo, grupo.nm_grupo, equipto.nm_equipto,
        equipto.cd_equipto, pes.nm_pessoa, nf1.cd_nftotal

      UNION

      /* 1B · Composição */
      SELECT grupo.cd_grupo, grupo.nm_grupo, 'C' AS TIPO,
        composicao.ds_composicao AS nm_equipto, composicao.cd_composicao AS cd_equipto,
        -1 AS cd_eq_pat, '' AS nm_eq_pat,
        SUM(((fl_fat_comp.quantidade * fl_fat_comp.vl_unitario) / nf1.vl_faturamento) * nffatur.vl_nffatur) AS VALOR,
        pes.nm_pessoa, nf1.cd_nftotal AS Categoria
      FROM fl_fatura WITH (NOLOCK)
      INNER JOIN fl_fat_comp WITH (NOLOCK) ON fl_fatura.cd_flfatura = fl_fat_comp.cd_flfatura
      INNER JOIN composicao WITH (NOLOCK) ON fl_fat_comp.cd_composicao = composicao.cd_composicao
      INNER JOIN grupo WITH (NOLOCK) ON composicao.cd_grupo = grupo.cd_grupo
      INNER JOIN nf nf1 WITH (NOLOCK) ON fl_fatura.cd_nf = nf1.cd_nf
      INNER JOIN v_nf_emissao V WITH (NOLOCK) ON nf1.cd_nf = V.cd_nf
      INNER JOIN fich_loc e WITH (NOLOCK) ON fl_fatura.cd_controle = e.cd_controle
      LEFT OUTER JOIN nffatur WITH (NOLOCK) ON nffatur.cd_nf = nf1.cd_nf
      LEFT OUTER JOIN pessoa pes WITH (NOLOCK) ON pes.cd_pessoa = nf1.cd_pessoa_fun
      WHERE nf1.vl_faturamento > 0
        ${emissionWindow('V', f)}
        ${reportCompanyFilter('e')}
        ${groupFilter('grupo.cd_grupo', f.groupId)}
        ${pf}
        ${onlyAllFamilies}
      GROUP BY grupo.cd_grupo, grupo.nm_grupo, composicao.ds_composicao,
        composicao.cd_composicao, pes.nm_pessoa, nf1.cd_nftotal

      UNION

      /* 1C · Patrimônio / medidor */
      SELECT grupo.cd_grupo, grupo.nm_grupo, 'P' AS TIPO,
        patrimon.nr_patrimonio AS nm_equipto, patrimon.cd_patrimonio AS cd_equipto,
        equipto.cd_equipto AS cd_eq_pat, equipto.nm_equipto AS nm_eq_pat,
        SUM((fl_fat_medidor.vl_total / nf1.vl_faturamento) * nffatur.vl_nffatur) AS VALOR,
        pes.nm_pessoa, nf1.cd_nftotal AS Categoria
      FROM fl_fatura WITH (NOLOCK)
      INNER JOIN fl_fat_medidor WITH (NOLOCK) ON fl_fatura.cd_flfatura = fl_fat_medidor.cd_flfatura
      INNER JOIN patrimon WITH (NOLOCK) ON fl_fat_medidor.cd_patrimonio = patrimon.cd_patrimonio
      INNER JOIN equipto WITH (NOLOCK) ON patrimon.cd_equipto = equipto.cd_equipto
      INNER JOIN grupo WITH (NOLOCK) ON equipto.cd_grupo = grupo.cd_grupo
      INNER JOIN nf nf1 WITH (NOLOCK) ON fl_fatura.cd_nf = nf1.cd_nf
      INNER JOIN v_nf_emissao V WITH (NOLOCK) ON nf1.cd_nf = V.cd_nf
      INNER JOIN fich_loc e WITH (NOLOCK) ON fl_fatura.cd_controle = e.cd_controle
      LEFT OUTER JOIN nffatur WITH (NOLOCK) ON nffatur.cd_nf = nf1.cd_nf
      LEFT OUTER JOIN pessoa pes WITH (NOLOCK) ON pes.cd_pessoa = nf1.cd_pessoa_fun
      WHERE nf1.vl_faturamento > 0
        ${emissionWindow('V', f)}
        ${reportCompanyFilter('e')}
        ${gfEquip}
        ${pf}
        ${ffEquip}
      GROUP BY grupo.cd_grupo, grupo.nm_grupo, patrimon.nr_patrimonio,
        patrimon.cd_patrimonio, equipto.nm_equipto, equipto.cd_equipto,
        pes.nm_pessoa, nf1.cd_nftotal

      UNION

      /* 1D · Apontamento faturado proporcionalmente */
      SELECT grupo.cd_grupo, grupo.nm_grupo, 'E' AS TIPO,
        equipto.nm_equipto, equipto.cd_equipto,
        equipto.cd_equipto AS cd_eq_pat, '' AS nm_eq_pat,
        SUM((FAT.vl_tot_cobranca / nf1.vl_faturamento) * nffatur.vl_nffatur) AS VALOR,
        pes.nm_pessoa, nf1.cd_nftotal AS Categoria
      FROM fl_fatura WITH (NOLOCK)
      INNER JOIN fl_apontamento_fatura FAT WITH (NOLOCK) ON fl_fatura.cd_flfatura = FAT.cd_flfatura
      INNER JOIN equipto WITH (NOLOCK) ON FAT.cd_equipto = equipto.cd_equipto
      INNER JOIN grupo WITH (NOLOCK) ON equipto.cd_grupo = grupo.cd_grupo
      INNER JOIN nf nf1 WITH (NOLOCK) ON fl_fatura.cd_nf = nf1.cd_nf
      INNER JOIN v_nf_emissao V WITH (NOLOCK) ON nf1.cd_nf = V.cd_nf
      INNER JOIN fich_loc e WITH (NOLOCK) ON fl_fatura.cd_controle = e.cd_controle
      LEFT OUTER JOIN nffatur WITH (NOLOCK) ON nffatur.cd_nf = nf1.cd_nf
      LEFT OUTER JOIN pessoa pes WITH (NOLOCK) ON pes.cd_pessoa = nf1.cd_pessoa_fun
      WHERE nf1.vl_faturamento > 0
        ${emissionWindow('V', f)}
        ${reportCompanyFilter('e')}
        ${gfEquip}
        ${pf}
        ${ffEquip}
      GROUP BY grupo.cd_grupo, grupo.nm_grupo, equipto.nm_equipto,
        equipto.cd_equipto, pes.nm_pessoa, nf1.cd_nftotal

      UNION

      /* 1E · Apontamento direto: esta é a exceção sem rateio por nffatur */
      SELECT grupo.cd_grupo, grupo.nm_grupo, 'E' AS TIPO,
        equipto.nm_equipto, equipto.cd_equipto,
        equipto.cd_equipto AS cd_eq_pat, '' AS nm_eq_pat,
        SUM(apo.vl_tot_hora_normal + apo.vl_tot_hora_excedente + apo.vl_tot_mob +
            apo.vl_tot_desmob + apo.vl_tot_acrescimo - apo.vl_tot_desconto) AS VALOR,
        pes.nm_pessoa, nf1.cd_nftotal AS Categoria
      FROM fl_fatura WITH (NOLOCK)
      INNER JOIN loc_fichloc_apont_apontamento apo WITH (NOLOCK)
        ON fl_fatura.cd_flfatura = apo.cd_flfatura
      INNER JOIN fl_fat_equ WITH (NOLOCK) ON fl_fatura.cd_flfatura = fl_fat_equ.cd_flfatura
      INNER JOIN equipto WITH (NOLOCK) ON fl_fat_equ.cd_equipto = equipto.cd_equipto
      INNER JOIN grupo WITH (NOLOCK) ON equipto.cd_grupo = grupo.cd_grupo
      INNER JOIN nf nf1 WITH (NOLOCK) ON fl_fatura.cd_nf = nf1.cd_nf
      INNER JOIN v_nf_emissao V WITH (NOLOCK) ON nf1.cd_nf = V.cd_nf
      INNER JOIN fich_loc e WITH (NOLOCK) ON fl_fatura.cd_controle = e.cd_controle
      LEFT OUTER JOIN nffatur WITH (NOLOCK) ON nffatur.cd_nf = nf1.cd_nf
      LEFT OUTER JOIN pessoa pes WITH (NOLOCK) ON pes.cd_pessoa = nf1.cd_pessoa_fun
      WHERE nf1.vl_faturamento > 0
        ${emissionWindow('V', f)}
        ${reportCompanyFilter('e')}
        ${gfEquip}
        ${pf}
        ${ffEquip}
      GROUP BY grupo.cd_grupo, grupo.nm_grupo, equipto.nm_equipto,
        equipto.cd_equipto, pes.nm_pessoa, nf1.cd_nftotal
    ) X
    GROUP BY X.cd_grupo, X.nm_grupo, X.TIPO, X.nm_equipto, X.cd_equipto,
      X.cd_eq_pat, X.nm_eq_pat, X.nm_pessoa, X.categoria
    ORDER BY X.TIPO`;
}

// 2) VENDA — equipamento vendido + grupo sintético 0 para fretes/seguro/IPI/ST/etc.
export function vendaSql(f: RateioFilters): string {
  const pf = personFilter('pes', f.personId);
  return `SELECT grupo.cd_grupo, grupo.nm_grupo,
      SUM(((pev_xequ.qt_pevxequ * pev_xequ.vl_uni_pevxequ) / nf1.vl_faturamento) * nffatur.vl_nffatur) AS VALOR,
      pes.nm_pessoa
    FROM ped_ven e WITH (NOLOCK)
    INNER JOIN pev_xequ WITH (NOLOCK) ON pev_xequ.cd_controle = e.cd_controle
    INNER JOIN equipto WITH (NOLOCK) ON pev_xequ.cd_equipto = equipto.cd_equipto
    INNER JOIN grupo WITH (NOLOCK) ON equipto.cd_grupo = grupo.cd_grupo
    INNER JOIN nf nf1 WITH (NOLOCK) ON e.cd_nf_pedven = nf1.cd_nf
    INNER JOIN v_nf_emissao V WITH (NOLOCK) ON nf1.cd_nf = V.cd_nf
    LEFT OUTER JOIN nffatur WITH (NOLOCK) ON nffatur.cd_nf = nf1.cd_nf
    LEFT OUTER JOIN pessoa pes WITH (NOLOCK) ON pes.cd_pessoa = nf1.cd_pessoa_fun
    WHERE e.cd_nf_pedven IS NOT NULL
      AND nf1.vl_faturamento > 0
      AND e.dt_ger_fatura IS NOT NULL
      ${emissionWindow('V', f)}
      ${reportCompanyFilter('e')}
      ${groupFilter('equipto.cd_grupo', f.groupId)}
      ${pf}
      ${familyFilter('equipto.cd_equfamilia', f.familyId)}
    GROUP BY grupo.cd_grupo, grupo.nm_grupo, pes.nm_pessoa

    UNION

    SELECT 0 AS cd_grupo, 'OUTROS (FRETES/SEG./IPI/ST/...)' AS nm_grupo,
      SUM(((e.vl_fre_pedven - e.vl_des_pedven + e.vl_dea_pedven + e.vl_ipi_pedven +
            e.vl_icms_st + e.vl_seg_pedven) / nf1.vl_faturamento) * nffatur.vl_nffatur) AS VALOR,
      pes.nm_pessoa
    FROM ped_ven e WITH (NOLOCK)
    INNER JOIN nf nf1 WITH (NOLOCK) ON e.cd_nf_pedven = nf1.cd_nf
    INNER JOIN v_nf_emissao V WITH (NOLOCK) ON nf1.cd_nf = V.cd_nf
    LEFT OUTER JOIN nffatur WITH (NOLOCK) ON nffatur.cd_nf = nf1.cd_nf
    LEFT OUTER JOIN pessoa pes WITH (NOLOCK) ON pes.cd_pessoa = nf1.cd_pessoa_fun
    WHERE e.cd_nf_pedven IS NOT NULL
      AND nf1.vl_faturamento > 0
      AND e.dt_ger_fatura IS NOT NULL
      ${emissionWindow('V', f)}
      ${reportCompanyFilter('e')}
      ${onlyWhenAllGroups(f.groupId)}
      ${pf}
      ${onlyWhenAllFamilies(f.familyId)}
    GROUP BY pes.nm_pessoa`;
}

// 3) MANUTENÇÃO / OM — três casos exatamente como no log do ERP.
export function manutencaoSql(f: RateioFilters): string {
  const pf = personFilter('pes', f.personId);
  const gf = groupFilter('equipto.cd_grupo', f.groupId);
  const ff = familyFilter('equipto.cd_equfamilia', f.familyId);

  const baseSelect = (amountExpr: string, extraWhere: string) => `SELECT
        grupo.cd_grupo, grupo.nm_grupo, 'M' AS tipo,
        equipto.nm_equipto AS nm_tipo, equipto.cd_equipto AS cd_tipo,
        -1 AS cd_eq_pat, '' AS nm_eq_pat, pes.nm_pessoa,
        ${amountExpr}, nff.vl_nffatur,
        (SELECT SUM(nf2.vl_nffatur) FROM nffatur nf2 WITH (NOLOCK) WHERE nf2.cd_nf = nf1.cd_nf) AS total_fatur
      FROM orcos e WITH (NOLOCK)
      INNER JOIN equipto WITH (NOLOCK) ON e.cd_equipto = equipto.cd_equipto
      INNER JOIN grupo WITH (NOLOCK) ON equipto.cd_grupo = grupo.cd_grupo
      INNER JOIN nf nf1 WITH (NOLOCK) ON e.cd_nf_fat = nf1.cd_nf
      INNER JOIN v_nf_emissao v WITH (NOLOCK) ON nf1.cd_nf = v.cd_nf
      LEFT OUTER JOIN nffatur nff WITH (NOLOCK) ON nff.cd_nf = nf1.cd_nf
      LEFT OUTER JOIN pessoa pes WITH (NOLOCK) ON pes.cd_pessoa = nf1.cd_pessoa_fun
      WHERE nf1.vl_faturamento > 0
        ${emissionWindow('v', f)}
        ${reportCompanyFilter('e')}
        ${gf}
        ${pf}
        ${ff}
        AND ${extraWhere}`;

  return `SELECT w.cd_grupo, w.nm_grupo, w.nm_pessoa, SUM(w.valor) AS VALOR
    FROM (
      /* 3A · Peças e serviços faturados na mesma NF de serviço */
      SELECT x.cd_grupo, x.nm_grupo, x.tipo, x.nm_tipo, x.cd_tipo,
        x.cd_eq_pat, x.nm_eq_pat,
        SUM((x.totalOS / x.total_fatur) * x.vl_nffatur) AS valor, x.nm_pessoa
      FROM (
        ${baseSelect('(e.vl_venda_material + e.vl_venda_servico) AS totalOS', '(e.cd_nf_fat_ven IS NULL OR e.cd_nf_fat = e.cd_nf_fat_ven)')}
      ) X
      GROUP BY x.cd_grupo, x.nm_grupo, x.tipo, x.nm_tipo, x.cd_tipo,
        x.cd_eq_pat, x.nm_eq_pat, x.nm_pessoa

      UNION

      /* 3B · Fatura de serviços da OM */
      SELECT x.cd_grupo, x.nm_grupo, x.tipo, x.nm_tipo, x.cd_tipo,
        x.cd_eq_pat, x.nm_eq_pat,
        SUM((x.vl_venda_servico / x.total_fatur) * x.vl_nffatur) AS valor, x.nm_pessoa
      FROM (
        ${baseSelect('e.vl_venda_servico', '(e.cd_nf_fat_ven IS NOT NULL AND e.cd_nf_fat <> e.cd_nf_fat_ven)')}
      ) X
      GROUP BY x.cd_grupo, x.nm_grupo, x.tipo, x.nm_tipo, x.cd_tipo,
        x.cd_eq_pat, x.nm_eq_pat, x.nm_pessoa

      UNION

      /* 3C · Fatura de materiais da OM */
      SELECT x.cd_grupo, x.nm_grupo, x.tipo, x.nm_tipo, x.cd_tipo,
        x.cd_eq_pat, x.nm_eq_pat,
        SUM((x.vl_venda_material / x.total_fatur) * x.vl_nffatur) AS valor, x.nm_pessoa
      FROM (
        ${baseSelect('e.vl_venda_material', '(e.cd_nf_fat IS NOT NULL AND e.cd_nf_fat <> e.cd_nf_fat_ven)')}
      ) X
      GROUP BY x.cd_grupo, x.nm_grupo, x.tipo, x.nm_tipo, x.cd_tipo,
        x.cd_eq_pat, x.nm_eq_pat, x.nm_pessoa
    ) w
    GROUP BY w.cd_grupo, w.nm_grupo, w.nm_pessoa`;
}

// 4) SERVIÇOS vinculados à ficha de locação.
export function servicoSql(f: RateioFilters): string {
  return `SELECT grupo.cd_grupo, grupo.nm_grupo,
      SUM((fs.vl_total / nf1.vl_faturamento) * nffatur.vl_nffatur) AS VALOR,
      pes.nm_pessoa
    FROM fichloc_servico fs WITH (NOLOCK)
    INNER JOIN servico s WITH (NOLOCK) ON fs.cd_servico = s.cd_servico
    INNER JOIN grupo WITH (NOLOCK) ON s.cd_grupo = grupo.cd_grupo
    INNER JOIN fich_loc e WITH (NOLOCK) ON fs.cd_controle = e.cd_controle
    INNER JOIN fl_fatura WITH (NOLOCK) ON fs.cd_flfatura = fl_fatura.cd_flfatura
    INNER JOIN nf nf1 WITH (NOLOCK) ON fl_fatura.cd_nf = nf1.cd_nf
    INNER JOIN v_nf_emissao V WITH (NOLOCK) ON nf1.cd_nf = V.cd_nf
    LEFT OUTER JOIN nffatur WITH (NOLOCK) ON nffatur.cd_nf = nf1.cd_nf
    LEFT OUTER JOIN pessoa pes WITH (NOLOCK) ON pes.cd_pessoa = nf1.cd_pessoa_fun
    WHERE nf1.vl_faturamento > 0
      ${emissionWindow('V', f)}
      ${reportCompanyFilter('e')}
      ${groupFilter('grupo.cd_grupo', f.groupId)}
      ${personFilter('pes', f.personId)}
      AND (fs.cd_fldevolucao IS NULL OR fs.cd_fldevolucao IN (
        SELECT fd2.cd_fldevolucao FROM fl_devolucao fd2 WITH (NOLOCK) WHERE fd2.fl_operacao = 'D'
      ))
      ${onlyWhenAllFamilies(f.familyId)}
    GROUP BY grupo.cd_grupo, grupo.nm_grupo, pes.nm_pessoa`;
}

// 5) INDENIZAÇÕES — a consulta do ERP une o caminho direto da devolução com o
// caminho associado a fichloc_servico e só então consolida por grupo/pessoa.
export function indenizacaoSql(f: RateioFilters): string {
  const common = (companyAlias = 'e') => `
      AND nf1.vl_faturamento > 0
      ${emissionWindow('V', f)}
      ${reportCompanyFilter(companyAlias)}
      ${groupFilter('grupo.cd_grupo', f.groupId)}
      ${personFilter('pes', f.personId)}
      ${familyFilter('equipto.cd_equfamilia', f.familyId)}`;

  return `SELECT X.cd_grupo, X.nm_grupo, SUM(X.valor) AS VALOR, X.nm_pessoa
    FROM (
      SELECT grupo.cd_grupo, grupo.nm_grupo,
        SUM(((fl_dev_equ.qt_devolucao * fl_dev_equ.vl_uni_indenizacao) / nf1.vl_faturamento) * nffatur.vl_nffatur) AS VALOR,
        pes.nm_pessoa
      FROM fl_devolucao fd WITH (NOLOCK)
      INNER JOIN fl_dev_equ WITH (NOLOCK) ON fd.cd_fldevolucao = fl_dev_equ.cd_fldevolucao
      INNER JOIN fl_rem_equ WITH (NOLOCK) ON fl_dev_equ.cd_flremequ = fl_rem_equ.cd_flremequ
      INNER JOIN equipto WITH (NOLOCK) ON fl_rem_equ.cd_equipto = equipto.cd_equipto
      INNER JOIN grupo WITH (NOLOCK) ON equipto.cd_grupo = grupo.cd_grupo
      INNER JOIN fich_loc e WITH (NOLOCK) ON fd.cd_controle = e.cd_controle
      INNER JOIN nf nf1 WITH (NOLOCK) ON fd.cd_nf = nf1.cd_nf
      INNER JOIN v_nf_emissao V WITH (NOLOCK) ON nf1.cd_nf = V.cd_nf
      LEFT OUTER JOIN nffatur WITH (NOLOCK) ON nffatur.cd_nf = nf1.cd_nf
      LEFT OUTER JOIN pessoa pes WITH (NOLOCK) ON pes.cd_pessoa = nf1.cd_pessoa_fun
      WHERE fd.fl_operacao = 'I'
        ${common('e')}
      GROUP BY grupo.cd_grupo, grupo.nm_grupo, pes.nm_pessoa

      UNION ALL

      SELECT grupo.cd_grupo, grupo.nm_grupo,
        SUM(((fl_dev_equ.qt_devolucao * fl_dev_equ.vl_uni_indenizacao) / nf1.vl_faturamento) * nffatur.vl_nffatur) AS VALOR,
        pes.nm_pessoa
      FROM fichloc_servico fs WITH (NOLOCK)
      INNER JOIN fl_devolucao fd WITH (NOLOCK) ON fs.cd_fldevolucao = fd.cd_fldevolucao
      INNER JOIN fl_dev_equ WITH (NOLOCK) ON fd.cd_fldevolucao = fl_dev_equ.cd_fldevolucao
      INNER JOIN fl_rem_equ WITH (NOLOCK) ON fl_dev_equ.cd_flremequ = fl_rem_equ.cd_flremequ
      INNER JOIN equipto WITH (NOLOCK) ON fl_rem_equ.cd_equipto = equipto.cd_equipto
      INNER JOIN grupo WITH (NOLOCK) ON equipto.cd_grupo = grupo.cd_grupo
      INNER JOIN fich_loc e WITH (NOLOCK) ON fs.cd_controle = e.cd_controle
      INNER JOIN fl_fatura WITH (NOLOCK) ON fs.cd_flfatura = fl_fatura.cd_flfatura
      INNER JOIN nf nf1 WITH (NOLOCK) ON fl_fatura.cd_nf = nf1.cd_nf
      INNER JOIN v_nf_emissao V WITH (NOLOCK) ON nf1.cd_nf = V.cd_nf
      LEFT OUTER JOIN nffatur WITH (NOLOCK) ON nffatur.cd_nf = nf1.cd_nf
      LEFT OUTER JOIN pessoa pes WITH (NOLOCK) ON pes.cd_pessoa = nf1.cd_pessoa_fun
      WHERE fd.fl_operacao = 'I'
        ${common('e')}
      GROUP BY grupo.cd_grupo, grupo.nm_grupo, pes.nm_pessoa
    ) X
    GROUP BY X.cd_grupo, X.nm_grupo, X.nm_pessoa
    ORDER BY X.cd_grupo`;
}

export function buildSislocRevenueQueries(f: RateioFilters) {
  return {
    locacao: locacaoSql(f),
    venda: vendaSql(f),
    manutencao: manutencaoSql(f),
    servico: servicoSql(f),
    indenizacao: indenizacaoSql(f),
  };
}
