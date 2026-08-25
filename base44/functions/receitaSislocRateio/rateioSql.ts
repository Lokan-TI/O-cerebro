// SQL de rateio do TGersReceitaGrupoRep (Sisloc).
// Fórmula: (valor_componente / nf.vl_faturamento) × nffatur.vl_nffatur
// Período filtrado por v_nf_emissao.dt_emissao (INNER JOIN — conforme log do ERP).
// Campos físicos validados contra v_Dicionario_Dados.

// 9 componentes de receita, todos resolvidos até grupo de equipamento.
const COMPONENTS_CTE = `      components AS (
        -- 1. RENTAL_EQUIPMENT
        SELECT fl_fatura.cd_nf, equipto.cd_grupo,
               ISNULL(fl_fat_equ.quantidade, 0) * ISNULL(fl_fat_equ.vl_unitario, 0) AS vl_componente,
               'RENTAL_EQUIPMENT' AS tp
        FROM fl_fat_equ WITH (NOLOCK)
        JOIN fl_fatura WITH (NOLOCK) ON fl_fat_equ.cd_flfatura = fl_fatura.cd_flfatura
        JOIN equipto WITH (NOLOCK) ON fl_fat_equ.cd_equipto = equipto.cd_equipto
        UNION ALL
        -- 2. RENTAL_COMPOSITION
        SELECT fl_fatura.cd_nf, composicao.cd_grupo,
               ISNULL(fl_fat_comp.quantidade, 0) * ISNULL(fl_fat_comp.vl_unitario, 0),
               'RENTAL_COMPOSITION'
        FROM fl_fat_comp WITH (NOLOCK)
        JOIN fl_fatura WITH (NOLOCK) ON fl_fat_comp.cd_flfatura = fl_fatura.cd_flfatura
        JOIN composicao WITH (NOLOCK) ON fl_fat_comp.cd_composicao = composicao.cd_composicao
        UNION ALL
        -- 3. METERED_ASSET
        SELECT fl_fatura.cd_nf, equipto.cd_grupo,
               ISNULL(fl_fat_medidor.vl_total, 0),
               'METERED_ASSET'
        FROM fl_fat_medidor WITH (NOLOCK)
        JOIN fl_fatura WITH (NOLOCK) ON fl_fat_medidor.cd_flfatura = fl_fatura.cd_flfatura
        JOIN patrimon WITH (NOLOCK) ON fl_fat_medidor.cd_patrimonio = patrimon.cd_patrimonio
        JOIN equipto WITH (NOLOCK) ON patrimon.cd_equipto = equipto.cd_equipto
        UNION ALL
        -- 4. APPOINTMENT
        SELECT fl_fatura.cd_nf, equipto.cd_grupo,
               ISNULL(fl_apontamento_fatura.vl_tot_cobranca, 0),
               'APPOINTMENT'
        FROM fl_apontamento_fatura WITH (NOLOCK)
        JOIN fl_fatura WITH (NOLOCK) ON fl_apontamento_fatura.cd_flfatura = fl_fatura.cd_flfatura
        JOIN equipto WITH (NOLOCK) ON fl_apontamento_fatura.cd_equipto = equipto.cd_equipto
        UNION ALL
        -- 5. SERVICE
        SELECT fl_fatura.cd_nf, servico.cd_grupo,
               ISNULL(fichloc_servico.vl_total, 0),
               'SERVICE'
        FROM fichloc_servico WITH (NOLOCK)
        JOIN fl_fatura WITH (NOLOCK) ON fichloc_servico.cd_flfatura = fl_fatura.cd_flfatura
        JOIN servico WITH (NOLOCK) ON fichloc_servico.cd_servico = servico.cd_servico
        UNION ALL
        -- 6. SALE
        SELECT ped_ven.cd_nf_pedven, equipto.cd_grupo,
               ISNULL(pev_xequ.qt_pevxequ, 0) * ISNULL(pev_xequ.vl_uni_pevxequ, 0),
               'SALE'
        FROM pev_xequ WITH (NOLOCK)
        JOIN ped_ven WITH (NOLOCK) ON pev_xequ.cd_controle = ped_ven.cd_controle
        JOIN equipto WITH (NOLOCK) ON pev_xequ.cd_equipto = equipto.cd_equipto
        WHERE ped_ven.cd_nf_pedven IS NOT NULL
        UNION ALL
        -- 7. MAINTENANCE_ORDER
        SELECT orcos.cd_nf_fat, equipto.cd_grupo,
               ISNULL(nf_om.vl_faturamento, 0),
               'MAINTENANCE_ORDER'
        FROM orcos WITH (NOLOCK)
        JOIN equipto WITH (NOLOCK) ON orcos.cd_equipto = equipto.cd_equipto
        JOIN nf nf_om WITH (NOLOCK) ON orcos.cd_nf_fat = nf_om.cd_nf
        WHERE orcos.cd_nf_fat IS NOT NULL
        UNION ALL
        -- 7b. MAINTENANCE_ORDER_PARTS
        SELECT orcos.cd_nf_fat_ven, equipto.cd_grupo,
               ISNULL(nf_om2.vl_faturamento, 0),
               'MAINTENANCE_ORDER_PARTS'
        FROM orcos WITH (NOLOCK)
        JOIN equipto WITH (NOLOCK) ON orcos.cd_equipto = equipto.cd_equipto
        JOIN nf nf_om2 WITH (NOLOCK) ON orcos.cd_nf_fat_ven = nf_om2.cd_nf
        WHERE orcos.cd_nf_fat_ven IS NOT NULL
        UNION ALL
        -- 8. INDEMNIFICATION
        SELECT fl_devolucao.cd_nf, equipto.cd_grupo,
               ISNULL(fl_dev_equ.qt_devolucao, 0) * ISNULL(fl_dev_equ.vl_uni_indenizacao, 0),
               'INDEMNIFICATION'
        FROM fl_devolucao WITH (NOLOCK)
        JOIN fl_dev_equ WITH (NOLOCK) ON fl_devolucao.cd_fldevolucao = fl_dev_equ.cd_fldevolucao
        JOIN fl_rem_equ WITH (NOLOCK) ON fl_dev_equ.cd_flremequ = fl_rem_equ.cd_flremequ
        JOIN equipto WITH (NOLOCK) ON fl_rem_equ.cd_equipto = equipto.cd_equipto
      )`;

function baseCtes(startDate: string, endDate: string): string {
  return `WITH nf_base AS (
        SELECT DISTINCT nf.cd_nf, nf.vl_faturamento, nf.cd_empresa
        FROM nf WITH (NOLOCK)
        INNER JOIN v_nf_emissao V WITH (NOLOCK) ON nf.cd_nf = V.cd_nf
        WHERE nf.fl_ent_sai = 'S'
          AND ISNULL(CAST(nf.fl_can_nf AS varchar(5)), 'N') NOT IN ('S', '1')
          AND nf.dt_cancelamento IS NULL
          AND nf.dt_anul_nf IS NULL
          AND V.dt_emissao >= '${startDate}'
          AND V.dt_emissao < '${endDate}'
      ),
      nffatur_total AS (
        SELECT cd_nf, SUM(ISNULL(vl_nffatur, 0)) AS vl_nffatur_total
        FROM nffatur WITH (NOLOCK)
        GROUP BY cd_nf
      ),
${COMPONENTS_CTE}`;
}

// Total rateado consolidado.
export function rateioGlobalSql(startDate: string, endDate: string): string {
  return `${baseCtes(startDate, endDate)}
      SELECT
        SUM(ISNULL(c.vl_componente, 0) / NULLIF(nb.vl_faturamento, 0) * ISNULL(nt.vl_nffatur_total, 0)) AS vl_total_rateado,
        COUNT(DISTINCT nb.cd_nf) AS qtd_nfs_com_componente,
        SUM(ISNULL(c.vl_componente, 0)) AS vl_total_componentes_bruto
      FROM nf_base nb
      JOIN components c ON nb.cd_nf = c.cd_nf
      LEFT JOIN nffatur_total nt ON nb.cd_nf = nt.cd_nf`;
}

// Rateio por grupo de equipamento.
export function rateioGrupoSql(startDate: string, endDate: string): string {
  return `${baseCtes(startDate, endDate)}
      SELECT
        grupo.cd_grupo,
        grupo.nm_grupo,
        SUM(ISNULL(c.vl_componente, 0) / NULLIF(nb.vl_faturamento, 0) * ISNULL(nt.vl_nffatur_total, 0)) AS vl_rateado,
        SUM(ISNULL(c.vl_componente, 0)) AS vl_componente_bruto
      FROM nf_base nb
      JOIN components c ON nb.cd_nf = c.cd_nf
      LEFT JOIN nffatur_total nt ON nb.cd_nf = nt.cd_nf
      JOIN grupo WITH (NOLOCK) ON c.cd_grupo = grupo.cd_grupo
      GROUP BY grupo.cd_grupo, grupo.nm_grupo
      ORDER BY vl_rateado DESC`;
}

// Rateio por tipo de componente de receita.
export function rateioComponenteSql(startDate: string, endDate: string): string {
  return `${baseCtes(startDate, endDate)}
      SELECT c.tp AS tipo_componente,
        SUM(ISNULL(c.vl_componente, 0) / NULLIF(nb.vl_faturamento, 0) * ISNULL(nt.vl_nffatur_total, 0)) AS vl_rateado,
        SUM(ISNULL(c.vl_componente, 0)) AS vl_componente_bruto,
        COUNT(DISTINCT nb.cd_nf) AS qtd_nfs
      FROM nf_base nb
      JOIN components c ON nb.cd_nf = c.cd_nf
      LEFT JOIN nffatur_total nt ON nb.cd_nf = nt.cd_nf
      GROUP BY c.tp
      ORDER BY vl_rateado DESC`;
}