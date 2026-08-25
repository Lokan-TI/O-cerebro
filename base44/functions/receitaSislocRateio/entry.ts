import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { execRead } from '../../shared/erpConnection.ts';
import { resolvePeriod } from '../../shared/periodContract.ts';
import { EXCLUDED_EMPRESAS, EXCLUDED_EMPRESAS_REASON } from '../../shared/empresaScope.ts';
import { buildSislocRevenueQueries, type RateioFilters } from './rateioSql.ts';

// Benchmark executável do relatório SISLOC "Receita por Grupo" (TGersReceitaGrupoList).
// A implementação replica os cinco blocos SQL observados no full log de 25/08/2026:
// locação, venda, manutenção/OM, serviços e indenizações.
//
// Importante: isto NÃO é MTR-001 / SUM(nf.vl_faturamento) e também NÃO é
// fl_fatura.vl_fatura. É uma terceira métrica, com semântica própria do relatório.

function rowsOf(result: any): any[] {
  if (Array.isArray(result?.recordset) && result.recordset.length > 0) return result.recordset;
  if (Array.isArray(result?.recordsets)) {
    for (let i = result.recordsets.length - 1; i >= 0; i--) {
      const rs = result.recordsets[i];
      if (Array.isArray(rs) && rs.length > 0) return rs;
    }
  }
  if (Array.isArray(result)) return result;
  return [];
}

function num(v: unknown) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function col(row: any, name: string) {
  if (!row) return undefined;
  return row[name] ?? row[name.toUpperCase()] ?? row[name.toLowerCase()];
}

function safeInt(value: unknown, field: string) {
  if (value == null || value === '') return 0;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) throw new Error(`${field} deve ser um inteiro >= 0.`);
  return n;
}

function normalizeRow(row: any) {
  return {
    cd_grupo: num(col(row, 'cd_grupo')),
    nm_grupo: String(col(row, 'nm_grupo') || ''),
    nm_pessoa: String(col(row, 'nm_pessoa') || ''),
    valor: num(col(row, 'valor')),
    tipo: col(row, 'tipo') == null ? null : String(col(row, 'tipo')),
    nm_tipo: col(row, 'nm_tipo') == null ? null : String(col(row, 'nm_tipo')),
    cd_tipo: col(row, 'cd_tipo') == null ? null : num(col(row, 'cd_tipo')),
    cd_eq_pat: col(row, 'cd_eq_pat') == null ? null : num(col(row, 'cd_eq_pat')),
    nm_eq_pat: col(row, 'nm_eq_pat') == null ? null : String(col(row, 'nm_eq_pat')),
    categoria: col(row, 'categoria') == null ? null : col(row, 'categoria'),
  };
}

function sumRows(rows: any[]) {
  return rows.reduce((s, r) => s + num(col(r, 'valor')), 0);
}

function aggregateGroups(branchRows: Record<string, any[]>) {
  const map = new Map<string, any>();
  const branchFields: Record<string, string> = {
    locacao: 'vl_locacao',
    venda: 'vl_venda',
    manutencao: 'vl_manutencao',
    servico: 'vl_servico',
    indenizacao: 'vl_indenizacao',
  };

  for (const [branch, rows] of Object.entries(branchRows)) {
    const field = branchFields[branch];
    if (!field) continue;
    for (const raw of rows) {
      const r = normalizeRow(raw);
      const key = `${r.cd_grupo}|${r.nm_pessoa}`;
      if (!map.has(key)) {
        map.set(key, {
          cd_grupo: r.cd_grupo,
          nm_grupo: r.nm_grupo,
          nm_pessoa: r.nm_pessoa,
          vl_locacao: 0,
          vl_venda: 0,
          vl_manutencao: 0,
          vl_servico: 0,
          vl_indenizacao: 0,
        });
      }
      const item = map.get(key);
      item[field] += r.valor;
      if (!item.nm_grupo && r.nm_grupo) item.nm_grupo = r.nm_grupo;
    }
  }

  return [...map.values()]
    .map((r) => ({
      ...r,
      vl_total: r.vl_locacao + r.vl_venda + r.vl_manutencao + r.vl_servico + r.vl_indenizacao,
    }))
    .sort((a, b) => b.vl_total - a.vl_total || a.cd_grupo - b.cd_grupo);
}

export default async function (req: Request): Promise<Response> {
  const startedAt = Date.now();
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));

    // A variante capturada no ERP usa tipo_periodo=1. Recusar outros tipos evita
    // chamar uma aproximação de "fiel" antes de capturarmos os logs dessas variantes.
    const periodType = Number(body?.period_type ?? body?.tipo_periodo ?? 1);
    if (periodType !== 1) {
      return Response.json({
        success: false,
        error: 'Receita por Grupo canônica está homologada apenas para tipo_periodo=1 (v_nf_emissao.dt_emissao).',
      }, { status: 400 });
    }

    const today = new Date().toISOString().slice(0, 10);
    const period = resolvePeriod({
      start: body?.start_date || body?.period_start,
      endInclusive: body?.end_date || body?.period_end_inclusive,
      endExclusive: body?.end_date_exclusive || body?.period_end_exclusive,
      defaultStart: `${new Date().getFullYear()}-01-01`,
      defaultEndInclusive: today,
    });

    const filters: RateioFilters = {
      startDate: period.start,
      endDateExclusive: period.endExclusive,
      groupId: safeInt(body?.cd_grupo, 'cd_grupo'),
      personId: safeInt(body?.cd_pessoa_fun, 'cd_pessoa_fun'),
      familyId: safeInt(body?.cd_equfamilia, 'cd_equfamilia'),
    };

    let source: Record<string, unknown> = { credential_reference: 'env' };
    if (body?.source_id) {
      source = await base44.asServiceRole.entities.ErpDataSource.get(body.source_id);
      if (!source) return Response.json({ success: false, error: 'Fonte de dados não encontrada.' }, { status: 404 });
    }

    const queries = buildSislocRevenueQueries(filters);
    const branchRows: Record<string, any[]> = {
      locacao: [],
      venda: [],
      manutencao: [],
      servico: [],
      indenizacao: [],
    };
    const branchErrors: Record<string, string> = {};

    // Execução sequencial: o ERP/Sisloc compartilha recursos de conexão e historicamente
    // responde melhor quando essas consultas pesadas não são disparadas em paralelo.
    for (const branch of ['locacao', 'venda', 'manutencao', 'servico', 'indenizacao']) {
      try {
        branchRows[branch] = rowsOf(await execRead(source, queries[branch], 120000));
      } catch (e) {
        branchErrors[branch] = (e as Error)?.message || String(e);
      }
    }

    const branchSummary = Object.fromEntries(
      Object.entries(branchRows).map(([branch, rows]) => [branch, {
        valor: sumRows(rows),
        rows: rows.length,
        error: branchErrors[branch] || null,
      }]),
    );

    const total = Object.values(branchSummary).reduce((s: number, b: any) => s + num(b.valor), 0);
    const byGroup = aggregateGroups(branchRows);
    const hasErrors = Object.keys(branchErrors).length > 0;
    const includeRows = body?.include_rows === true;

    // Aliases de compatibilidade para consumidores antigos da função. O conteúdo agora
    // vem do relatório fiel, e não da antiga CTE aproximada.
    const rateioPorComponente = Object.entries(branchSummary).map(([tipo, v]: [string, any]) => ({
      tipo_componente: tipo.toUpperCase(),
      vl_rateado: v.valor,
      qtd_linhas: v.rows,
      error: v.error,
    }));

    return Response.json({
      success: !hasErrors,
      partial: hasErrors,
      metric: {
        id: 'SISLOC-RECEITA-GRUPO',
        name: 'Receita por Grupo SISLOC',
        status: hasErrors ? 'PARTIAL' : 'RECONCILIATION_READY',
        source_report: 'TGersReceitaGrupoList',
        formula_base: '(valor_componente / nf.vl_faturamento) × nffatur.vl_nffatur',
        exception: 'loc_fichloc_apont_apontamento soma os componentes do apontamento diretamente, sem rateio por nffatur',
        time_dimension: 'v_nf_emissao.dt_emissao',
      },
      analysis_context: {
        period_start: period.start,
        period_end_inclusive: period.endInclusive,
        period_end_exclusive: period.endExclusive,
        period_type: 1,
        cd_grupo: filters.groupId || 0,
        cd_pessoa_fun: filters.personId || 0,
        cd_equfamilia: filters.familyId || 0,
        excluded_companies: EXCLUDED_EMPRESAS,
        excluded_companies_reason: EXCLUDED_EMPRESAS_REASON,
      },
      total,
      branches: branchSummary,
      by_group: byGroup,
      errors: branchErrors,
      lineage: Object.entries(queries).map(([branch, sql]) => ({ branch, sql })),
      ...(includeRows ? {
        raw_rows: Object.fromEntries(
          Object.entries(branchRows).map(([branch, rows]) => [branch, rows.map(normalizeRow)]),
        ),
      } : {}),

      // Compatibilidade com a resposta antiga
      rateio_global: { vl_total_rateado: total },
      rateio_por_componente: rateioPorComponente,
      rateio_por_grupo: byGroup.map((r) => ({
        cd_grupo: r.cd_grupo,
        nm_grupo: r.nm_grupo,
        nm_pessoa: r.nm_pessoa,
        vl_rateado: r.vl_total,
      })),
      duration_ms: Date.now() - startedAt,
    });
  } catch (error) {
    return Response.json({
      success: false,
      error: (error as Error)?.message || String(error),
      duration_ms: Date.now() - startedAt,
    }, { status: 500 });
  }
}
