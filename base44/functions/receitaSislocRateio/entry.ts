import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { execRead } from '../../shared/erpConnection.ts';
import { rateioGlobalSql, rateioGrupoSql, rateioComponenteSql } from './rateioSql.ts';

// Reproduz a lógica de rateio do Sisloc TGersReceitaGrupoList para reconciliar
// o Faturamento Bruto do Cérebro (SUM(nf.vl_faturamento)) com o valor exibido
// pelo ERP (baseado em nffatur, o parcelamento financeiro da NF).
// Fonte padrão: Matriz (conexão via variáveis de ambiente da plataforma).
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const startDate = String(body?.start_date || '2026-01-01');
    const endDate = String(body?.end_date || '2026-08-20');
    const breakdown = String(body?.breakdown || 'global');

    // Fonte: padrão Matriz (env); aceita source_id para outra unidade.
    let source: Record<string, unknown> = { credential_reference: 'env' };
    if (body?.source_id) {
      source = await base44.asServiceRole.entities.ErpDataSource.get(body.source_id);
      if (!source) return Response.json({ success: false, error: 'Fonte de dados não encontrada.' }, { status: 404 });
    }

    // Filtro comum de NFs de saída válidas no período
    const nfWhere = `nf.fl_ent_sai = 'S'
        AND ISNULL(CAST(nf.fl_can_nf AS varchar(5)), 'N') NOT IN ('S', '1')
        AND nf.dt_cancelamento IS NULL
        AND nf.dt_anul_nf IS NULL
        AND nf.dt_emi_nf >= '${startDate}'
        AND nf.dt_emi_nf < '${endDate}'`;

    // SQL 1 — FATURAMENTO_BRUTO_NF (o que o Cérebro mostra hoje)
    const sqlFaturamentoBruto = `SELECT SUM(ISNULL(nf.vl_faturamento, 0)) AS vl_faturamento_bruto_nf,
        COUNT(*) AS qtd_nfs
      FROM nf WITH (NOLOCK)
      WHERE ${nfWhere}`;

    // SQL 2 — Receita via nffatur (o que o ERP efetivamente considera)
    const sqlNffatur = `SELECT
        SUM(ISNULL(nffatur.vl_bruto, 0)) AS vl_nffatur_bruto,
        SUM(ISNULL(nffatur.vl_nffatur, 0)) AS vl_nffatur_liquido,
        COUNT(DISTINCT nffatur.cd_nf) AS qtd_nfs_com_nffatur
      FROM nffatur WITH (NOLOCK)
      JOIN nf WITH (NOLOCK) ON nffatur.cd_nf = nf.cd_nf
      WHERE ${nfWhere}`;

    // SQL 3 — NFs sem nffatur (existem na NF mas não no parcelamento)
    const sqlNfsSemNffatur = `SELECT
        COUNT(DISTINCT nf.cd_nf) AS qtd_nfs_sem_nffatur,
        SUM(ISNULL(nf.vl_faturamento, 0)) AS vl_nfs_sem_nffatur
      FROM nf WITH (NOLOCK)
      LEFT JOIN nffatur WITH (NOLOCK) ON nf.cd_nf = nffatur.cd_nf
      WHERE ${nfWhere}
        AND nffatur.cd_nf IS NULL`;

    // SQL 4 — NFs divergentes (nffatur total != nf.vl_faturamento)
    const sqlDivergencia = `SELECT TOP 50
        nf.cd_nf,
        nf.dt_emi_nf,
        nf.vl_faturamento,
        nft.vl_nffatur_total,
        nf.vl_faturamento - nft.vl_nffatur_total AS divergencia
      FROM nf WITH (NOLOCK)
      JOIN (
        SELECT cd_nf, SUM(ISNULL(vl_nffatur, 0)) AS vl_nffatur_total
        FROM nffatur WITH (NOLOCK)
        GROUP BY cd_nf
      ) nft ON nf.cd_nf = nft.cd_nf
      WHERE ${nfWhere}
        AND ABS(nf.vl_faturamento - nft.vl_nffatur_total) > 0.01
      ORDER BY ABS(nf.vl_faturamento - nft.vl_nffatur_total) DESC`;

    // SQL 5 — Rateio completo do TGersReceitaGrupoRep (9 componentes de receita)
    const sqlRateioGlobal = rateioGlobalSql(startDate, endDate);
    const sqlRateioGrupo = rateioGrupoSql(startDate, endDate);
    const sqlRateioComponente = rateioComponenteSql(startDate, endDate);

    // Filtro alternativo de período — hipótese: o ERP usa v_nf_emissao.dt_emissao
    const viewWhere = `nf.fl_ent_sai = 'S'
        AND ISNULL(CAST(nf.fl_can_nf AS varchar(5)), 'N') NOT IN ('S', '1')
        AND nf.dt_cancelamento IS NULL
        AND nf.dt_anul_nf IS NULL
        AND v_nf_emissao.dt_emissao >= '${startDate}'
        AND v_nf_emissao.dt_emissao < '${endDate}'`;

    // SQL 6 — SUM(nf.vl_faturamento) filtrado por v_nf_emissao.dt_emissao
    const sqlFaturamentoViaView = `SELECT SUM(ISNULL(nf.vl_faturamento, 0)) AS vl_faturamento_view,
        COUNT(*) AS qtd_nfs
      FROM nf WITH (NOLOCK)
      INNER JOIN v_nf_emissao WITH (NOLOCK) ON nf.cd_nf = v_nf_emissao.cd_nf
      WHERE ${viewWhere}`;

    // SQL 7 — SUM(nffatur.vl_nffatur) filtrado por v_nf_emissao.dt_emissao
    const sqlNffaturViaView = `SELECT
        SUM(ISNULL(nffatur.vl_nffatur, 0)) AS vl_nffatur_view,
        COUNT(DISTINCT nffatur.cd_nf) AS qtd_nfs_com_nffatur
      FROM nffatur WITH (NOLOCK)
      JOIN nf WITH (NOLOCK) ON nffatur.cd_nf = nf.cd_nf
      INNER JOIN v_nf_emissao WITH (NOLOCK) ON nf.cd_nf = v_nf_emissao.cd_nf
      WHERE ${viewWhere}`;

    // SQL 8 — NFs sem correspondência na view ou com data divergente
    const sqlDiferencaDatas = `SELECT TOP 50
        nf.cd_nf,
        nf.dt_emi_nf,
        v.dt_emissao,
        nf.vl_faturamento,
        CASE
          WHEN v.dt_emissao IS NULL THEN 'SEM_VIEW'
          WHEN nf.dt_emi_nf <> v.dt_emissao THEN 'DATA_DIFERENTE'
          ELSE 'IGUAL'
        END AS status_data
      FROM nf WITH (NOLOCK)
      LEFT JOIN v_nf_emissao v WITH (NOLOCK) ON nf.cd_nf = v.cd_nf
      WHERE nf.fl_ent_sai = 'S'
        AND ISNULL(CAST(nf.fl_can_nf AS varchar(5)), 'N') NOT IN ('S', '1')
        AND nf.dt_cancelamento IS NULL
        AND nf.dt_anul_nf IS NULL
        AND (
          (nf.dt_emi_nf >= '${startDate}' AND nf.dt_emi_nf < '${endDate}')
          OR (v.dt_emissao >= '${startDate}' AND v.dt_emissao < '${endDate}')
        )
        AND (v.cd_nf IS NULL OR nf.dt_emi_nf <> v.dt_emissao)
      ORDER BY nf.cd_nf DESC`;

    const pick = (result: any): Record<string, unknown>[] => {
      if (Array.isArray(result?.recordset) && result.recordset.length > 0) return result.recordset;
      if (Array.isArray(result?.recordsets)) {
        for (let i = result.recordsets.length - 1; i >= 0; i--) {
          const rs = result.recordsets[i];
          if (Array.isArray(rs) && rs.length > 0) return rs;
        }
      }
      return [];
    };

    const t0 = Date.now();
    const results: Record<string, unknown> = {};

    // Execução sequencial — o ERP não tolera consultas concorrentes.
    try { results.faturamento_bruto_nf = pick(await execRead(source, sqlFaturamentoBruto, 60000))[0] || null; }
    catch (e) { results.faturamento_bruto_nf_error = (e as Error)?.message; }

    try { results.nffatur = pick(await execRead(source, sqlNffatur, 60000))[0] || null; }
    catch (e) { results.nffatur_error = (e as Error)?.message; }

    try { results.nfs_sem_nffatur = pick(await execRead(source, sqlNfsSemNffatur, 60000))[0] || null; }
    catch (e) { results.nfs_sem_nffatur_error = (e as Error)?.message; }

    try { results.divergencias = pick(await execRead(source, sqlDivergencia, 60000)); }
    catch (e) { results.divergencias_error = (e as Error)?.message; }

    try { results.faturamento_via_view = pick(await execRead(source, sqlFaturamentoViaView, 60000))[0] || null; }
    catch (e) { results.faturamento_via_view_error = (e as Error)?.message; }

    try { results.nffatur_via_view = pick(await execRead(source, sqlNffaturViaView, 60000))[0] || null; }
    catch (e) { results.nffatur_via_view_error = (e as Error)?.message; }

    try { results.diferenca_datas = pick(await execRead(source, sqlDiferencaDatas, 60000)); }
    catch (e) { results.diferenca_datas_error = (e as Error)?.message; }

    try { results.rateio_global = pick(await execRead(source, sqlRateioGlobal, 120000))[0] || null; }
    catch (e) { results.rateio_global_error = (e as Error)?.message; }

    try { results.rateio_por_componente = pick(await execRead(source, sqlRateioComponente, 120000)); }
    catch (e) { results.rateio_componente_error = (e as Error)?.message; }

    if (breakdown === 'group') {
      try { results.rateio_por_grupo = pick(await execRead(source, sqlRateioGrupo, 120000)); }
      catch (e) { results.rateio_grupo_error = (e as Error)?.message; }
    }

    results.resumo = {
      esperado_erp_sisloc: 38666349.68,
      periodo: `${startDate} a ${endDate}`,
      formula_rateio_erp: '(valor_componente / nf.vl_faturamento) × nffatur.vl_nffatur',
      periodo_filtro_rateio: 'v_nf_emissao.dt_emissao (INNER JOIN — conforme log do ERP)',
      componentes: ['RENTAL_EQUIPMENT', 'RENTAL_COMPOSITION', 'METERED_ASSET', 'APPOINTMENT', 'SERVICE', 'SALE', 'MAINTENANCE_ORDER', 'MAINTENANCE_ORDER_PARTS', 'INDEMNIFICATION'],
      objetivo: 'o total rateado deve bater R$ 38.666.349,68',
    };
    results.queries = {
      faturamento_bruto_nf: sqlFaturamentoBruto,
      nffatur: sqlNffatur,
      nfs_sem_nffatur: sqlNfsSemNffatur,
      divergencias: sqlDivergencia,
      faturamento_via_view: sqlFaturamentoViaView,
      nffatur_via_view: sqlNffaturViaView,
      diferenca_datas: sqlDiferencaDatas,
      rateio_global: sqlRateioGlobal,
      rateio_por_componente: sqlRateioComponente,
      ...(breakdown === 'group' ? { rateio_por_grupo: sqlRateioGrupo } : {}),
    };
    results.duration_ms = Date.now() - t0;

    return Response.json({ success: true, ...results });
  } catch (error) {
    return Response.json({ success: false, error: (error as Error)?.message || String(error) }, { status: 500 });
  }
}