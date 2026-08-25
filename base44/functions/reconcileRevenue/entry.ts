import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { execRead } from '../../shared/erpConnection.ts';
import { empFilter } from '../../shared/empresaScope.ts';
import { invoiceUniverse } from '../../shared/invoiceUniverse.ts';

// MTR-001 · Reconciliação de candidatos a "Receita".
// Objetivo: dar base factual para os donos de negócio escolherem o Source of Truth.
// Nenhum candidato é declarado oficial aqui — a função apenas mede.
const CANDIDATES = [
  { id: 'A_vl_faturamento', label: 'Σ vl_faturamento (campo sintético do ERP)', expr: 'SUM(ISNULL(vl_faturamento,0))' },
  { id: 'B_vl_total_nf', label: 'Σ vl_total_nf (valor total da NF)', expr: 'SUM(ISNULL(vl_total_nf,0))' },
  { id: 'C_merc_mais_serv', label: 'Σ vl_merc_nf + vl_serv_nf (mercadorias + serviços)', expr: 'SUM(ISNULL(vl_merc_nf,0) + ISNULL(vl_serv_nf,0))' },
  { id: 'D_vl_liquido_nf', label: 'Σ vl_liquido_nf (valor líquido)', expr: 'SUM(ISNULL(vl_liquido_nf,0))' },
];

// Universo oficial da reconciliação: NF de saída, não cancelada e não anulada.
const BASE_FILTER = `${invoiceUniverse()} ${empFilter()}`;

function dateRange(start: string, end: string) {
  return `dt_emi_nf >= '${start}' AND dt_emi_nf < '${end}'`;
}

export default async function (req: Request): Promise<Response> {
  const started = Date.now();
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Apenas administradores podem executar a reconciliação de receita.' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const periodStart = body?.period_start || '2025-01-01';
    const periodEnd = body?.period_end || '2026-01-01';

    let source = null;
    if (body?.source_id) {
      source = await base44.asServiceRole.entities.ErpDataSource.get(body.source_id);
    } else {
      const list = await base44.asServiceRole.entities.ErpDataSource.filter({ credential_reference: 'env' });
      source = list?.[0] || null;
    }
    if (!source) return Response.json({ error: 'Fonte de dados não encontrada.' }, { status: 404 });

    const range = dateRange(periodStart, periodEnd);
    let queryCount = 0;

    // 1 — Candidatos consolidados + contagem de notas do universo
    const selectList = CANDIDATES.map((c) => `${c.expr} AS ${c.id}`).join(', ');
    const totalsRes = await execRead(
      source,
      `SELECT COUNT(*) AS notas, ${selectList} FROM nf WHERE ${BASE_FILTER} AND ${range}`,
      60000
    );
    queryCount++;
    const t = totalsRes.recordset?.[0] || {};
    const invoiceCount = Number(t.notas || 0);
    const reference = Number(t.A_vl_faturamento || 0);
    const candidates = CANDIDATES.map((c) => {
      const total = Number(t[c.id] || 0);
      return {
        id: c.id,
        label: c.label,
        total,
        diff_vs_reference: total - reference,
        diff_pct_vs_reference: reference ? Math.round(((total - reference) / reference) * 1000) / 10 : null,
      };
    });

    // 2 — Impacto das notas excluídas (canceladas/anuladas) sobre o candidato de referência
    const excludedRes = await execRead(
      source,
      `SELECT COUNT(*) AS notas, SUM(ISNULL(vl_faturamento,0)) AS valor FROM nf WHERE fl_ent_sai = 'S' AND (ISNULL(CAST(fl_can_nf AS varchar(5)),'N') IN ('S','1') OR dt_cancelamento IS NOT NULL OR dt_anul_nf IS NOT NULL) AND ${range} ${empFilter()}`,
      60000
    );
    queryCount++;
    const ex = excludedRes.recordset?.[0] || {};
    const excluded = { invoice_count: Number(ex.notas || 0), amount: Number(ex.valor || 0) };

    // 3 — Quebra por empresa (candidato de referência x total da NF)
    const byEmpresaRes = await execRead(
      source,
      `SELECT cd_empresa, COUNT(*) AS notas, SUM(ISNULL(vl_faturamento,0)) AS a_faturamento, SUM(ISNULL(vl_total_nf,0)) AS b_total_nf FROM nf WHERE ${BASE_FILTER} AND ${range} GROUP BY cd_empresa ORDER BY cd_empresa`,
      60000
    );
    queryCount++;
    const byEmpresa = (byEmpresaRes.recordset || []).map((r: any) => ({
      cd_empresa: r.cd_empresa,
      invoice_count: Number(r.notas || 0),
      a_faturamento: Number(r.a_faturamento || 0),
      b_total_nf: Number(r.b_total_nf || 0),
      diff: Number(r.b_total_nf || 0) - Number(r.a_faturamento || 0),
    }));

    // 4 — Notas do universo com vl_faturamento zerado (risco de completeness)
    const zeroRes = await execRead(
      source,
      `SELECT COUNT(*) AS notas FROM nf WHERE ${BASE_FILTER} AND ${range} AND ISNULL(vl_faturamento,0) = 0`,
      60000
    );
    queryCount++;
    const zeroFaturamento = Number(zeroRes.recordset?.[0]?.notas || 0);

    // 5 — Diagnóstico em camadas contra o contrato do TGersReceitaGrupoList.
    // Não declara equivalência entre os totais; isola onde a diferença nasce:
    // data da view fiscal -> vínculo com fatos operacionais -> base nffatur.
    const reportCompanies = '(0,4,7,8,9,11,10,13,12,6,5)';
    const diagnosticSql = `WITH report_nf AS (
      SELECT DISTINCT ff.cd_nf
      FROM fl_fatura ff WITH (NOLOCK)
      INNER JOIN fich_loc e WITH (NOLOCK) ON e.cd_controle = ff.cd_controle
      WHERE ff.cd_nf IS NOT NULL AND e.cd_empresa IN ${reportCompanies}
      UNION
      SELECT DISTINCT p.cd_nf_pedven
      FROM ped_ven p WITH (NOLOCK)
      WHERE p.cd_nf_pedven IS NOT NULL AND p.dt_ger_fatura IS NOT NULL AND p.cd_empresa IN ${reportCompanies}
      UNION
      SELECT DISTINCT o.cd_nf_fat
      FROM orcos o WITH (NOLOCK)
      WHERE o.cd_nf_fat IS NOT NULL AND o.cd_empresa IN ${reportCompanies}
      UNION
      SELECT DISTINCT fd.cd_nf
      FROM fl_devolucao fd WITH (NOLOCK)
      INNER JOIN fich_loc e WITH (NOLOCK) ON e.cd_controle = fd.cd_controle
      WHERE fd.cd_nf IS NOT NULL AND fd.fl_operacao = 'I' AND e.cd_empresa IN ${reportCompanies}
    ), report_period_nf AS (
      SELECT DISTINCT n.cd_nf, n.vl_faturamento
      FROM report_nf r
      INNER JOIN nf n WITH (NOLOCK) ON n.cd_nf = r.cd_nf
      INNER JOIN v_nf_emissao v WITH (NOLOCK) ON v.cd_nf = n.cd_nf
      WHERE n.vl_faturamento > 0
        AND v.dt_emissao >= '${periodStart}' AND v.dt_emissao < '${periodEnd}'
    )
    SELECT
      (SELECT ISNULL(SUM(n.vl_faturamento),0)
         FROM nf n WITH (NOLOCK)
         INNER JOIN v_nf_emissao v WITH (NOLOCK) ON v.cd_nf = n.cd_nf
        WHERE ${invoiceUniverse('n')}
          AND n.vl_faturamento > 0
          AND v.dt_emissao >= '${periodStart}' AND v.dt_emissao < '${periodEnd}') AS view_date_same_universe_total,
      (SELECT COUNT(*) FROM report_period_nf) AS report_linked_invoice_count,
      (SELECT ISNULL(SUM(vl_faturamento),0) FROM report_period_nf) AS report_linked_nf_total,
      (SELECT ISNULL(SUM(x.v),0) FROM (
         SELECT r.cd_nf, ISNULL(SUM(nff.vl_nffatur),0) AS v
         FROM report_period_nf r
         LEFT JOIN nffatur nff WITH (NOLOCK) ON nff.cd_nf = r.cd_nf
         GROUP BY r.cd_nf
       ) x) AS report_linked_nffatur_total`;
    const diagnosticRes = await execRead(source, diagnosticSql, 60000);
    queryCount++;
    const dg = diagnosticRes.recordset?.[0] || {};
    const diagnostics = {
      current_nf_total: reference,
      view_date_same_universe_total: Number(dg.view_date_same_universe_total || 0),
      report_linked_invoice_count: Number(dg.report_linked_invoice_count || 0),
      report_linked_nf_total: Number(dg.report_linked_nf_total || 0),
      report_linked_nffatur_total: Number(dg.report_linked_nffatur_total || 0),
    };

    return Response.json({
      metric_id: 'MTR-001',
      status: 'RECONCILIATION_ONLY',
      note: 'Nenhum candidato é oficial. A escolha do Source of Truth exige decisão do dono de negócio (CFO) registrada em ADR.',
      period: { start: periodStart, end: periodEnd, date_field: 'dt_emi_nf' },
      universe: { filter: BASE_FILTER, invoice_count: invoiceCount },
      candidates,
      excluded_invoices: excluded,
      zero_amount_invoices: zeroFaturamento,
      by_empresa: byEmpresa,
      diagnostics,
      query_count: queryCount,
      duration_ms: Date.now() - started,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}