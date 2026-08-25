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
      query_count: queryCount,
      duration_ms: Date.now() - started,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}