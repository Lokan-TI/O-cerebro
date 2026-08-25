import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { execRead } from '../../shared/erpConnection.ts';
import { resolvePeriod } from '../../shared/periodContract.ts';
import { empFilter } from '../../shared/empresaScope.ts';
import { invoiceUniverse } from '../../shared/invoiceUniverse.ts';

// Lista COMPLETA de clientes ativos (com faturamento no período), na granularidade
// empresa Sisloc × cliente. Sem TOP: a lista não é mais limitada aos maiores clientes.
// Receita = SUM(nf.vl_faturamento) das NFs não canceladas.
// Contratos ativos = fich_loc em aberto (dt_enc_ficha NULL e não baixada) do cliente.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const resolvedPeriod = resolvePeriod({
      start: body?.start_date,
      endInclusive: body?.end_date,
      endExclusive: body?.end_date_exclusive,
      defaultStart: '2000-01-01',
      defaultEndInclusive: new Date().toISOString().slice(0, 10),
    });
    const startDate = resolvedPeriod.start;
    const endDate = resolvedPeriod.endInclusive;
    const endDateExclusive = resolvedPeriod.endExclusive;

    // Consulta 1 — receita por empresa × cliente (leve, só nf + nomes)
    const sql = `SELECT
      n.cd_empresa,
      COALESCE(NULLIF(LTRIM(RTRIM(e.nm_fan_empresa)), ''), CONCAT('Empresa ', n.cd_empresa)) AS nm_empresa,
      n.cd_pessoa,
      COALESCE(NULLIF(LTRIM(RTRIM(p.nm_fan_pessoa)), ''), LTRIM(RTRIM(p.nm_pessoa)), CONCAT('Cliente ', n.cd_pessoa)) AS nm_pessoa,
      ISNULL(SUM(n.vl_faturamento), 0) AS receita,
      COUNT(*) AS nfs,
      MAX(n.dt_emi_nf) AS ultima_nf
    FROM nf n WITH (NOLOCK)
    LEFT JOIN empresa e WITH (NOLOCK) ON e.cd_empresa = n.cd_empresa
    LEFT JOIN pessoa p WITH (NOLOCK) ON p.cd_pessoa = n.cd_pessoa
    WHERE n.dt_emi_nf >= '${startDate}' AND n.dt_emi_nf < '${endDateExclusive}'
      AND n.cd_pessoa IS NOT NULL
      AND ${invoiceUniverse('n')}
      ${empFilter('n')}
    GROUP BY n.cd_empresa, e.nm_fan_empresa, n.cd_pessoa, p.nm_fan_pessoa, p.nm_pessoa
    ORDER BY ISNULL(SUM(n.vl_faturamento), 0) DESC`;

    // Consulta 2 — total fiscal por empresa, SEM exigir cliente identificado.
    // Este é o valor comparável ao KPI de faturamento do snapshot/MTR-001.
    // A diferença para a soma das linhas de clientes representa NFs sem cd_pessoa.
    const fiscalSql = `SELECT n.cd_empresa,
        ISNULL(SUM(n.vl_faturamento),0) AS faturamento_fiscal,
        COUNT(*) AS nfs_fiscais,
        ISNULL(SUM(CASE WHEN n.cd_pessoa IS NULL THEN n.vl_faturamento ELSE 0 END),0) AS faturamento_sem_cliente,
        SUM(CASE WHEN n.cd_pessoa IS NULL THEN 1 ELSE 0 END) AS nfs_sem_cliente
      FROM nf n WITH (NOLOCK)
      WHERE n.dt_emi_nf >= '${startDate}' AND n.dt_emi_nf < '${endDateExclusive}'
        AND ${invoiceUniverse('n')}
        ${empFilter('n')}
      GROUP BY n.cd_empresa`;

    // Consulta 3 — contratos de locação por cliente (executada em separado para
    // não cruzar fich_loc com nf no mesmo plano de execução, o que estourava o tempo)
    const contratosSql = `SELECT cd_pessoa,
        COUNT(*) AS qtd_total,
        SUM(CASE WHEN dt_enc_ficha IS NULL AND ISNULL(fl_baixada, '') <> 'S' THEN 1 ELSE 0 END) AS qtd_ativas
      FROM fich_loc WITH (NOLOCK)
      WHERE cd_pessoa IS NOT NULL AND cd_pessoa <> ''
      ${empFilter()}
      GROUP BY cd_pessoa`;

    let source: Record<string, unknown> = { credential_reference: 'env' };
    if (body?.source_id) {
      source = await base44.asServiceRole.entities.ErpDataSource.get(body.source_id);
      if (!source) return Response.json({ success: false, error: 'Fonte de dados não encontrada.' }, { status: 404 });
    }

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
    const raw = pick(await execRead(source, sql, 90000));

    const warnings: string[] = [];
    let fiscalByEmpresa: Record<string, { faturamento_fiscal: number; nfs_fiscais: number; faturamento_sem_cliente: number; nfs_sem_cliente: number }> = {};
    try {
      for (const r of pick(await execRead(source, fiscalSql, 90000))) {
        fiscalByEmpresa[String(Number(r.cd_empresa))] = {
          faturamento_fiscal: Number(r.faturamento_fiscal) || 0,
          nfs_fiscais: Number(r.nfs_fiscais) || 0,
          faturamento_sem_cliente: Number(r.faturamento_sem_cliente) || 0,
          nfs_sem_cliente: Number(r.nfs_sem_cliente) || 0,
        };
      }
    } catch (e) {
      warnings.push('Total fiscal não carregado: ' + ((e as Error)?.message || '').slice(0, 120));
    }

    const contratos: Record<string, { ativas: number; total: number }> = {};
    try {
      for (const r of pick(await execRead(source, contratosSql, 90000))) {
        contratos[String(r.cd_pessoa || '').trim()] = {
          ativas: Number(r.qtd_ativas) || 0,
          total: Number(r.qtd_total) || 0,
        };
      }
    } catch (e) {
      warnings.push('Contratos de locação não carregados: ' + ((e as Error)?.message || '').slice(0, 120));
    }

    const rows = raw.map((r) => ({
      cd_empresa: Number(r.cd_empresa) || 0,
      nm_empresa: String(r.nm_empresa || ''),
      cd_pessoa: String(r.cd_pessoa || ''),
      nm_pessoa: String(r.nm_pessoa || ''),
      receita: Number(r.receita) || 0,
      nfs: Number(r.nfs) || 0,
      ultima_nf: r.ultima_nf ? new Date(r.ultima_nf as string).toISOString().slice(0, 10) : null,
      contratos_ativos: contratos[String(r.cd_pessoa || '').trim()]?.ativas ?? 0,
      contratos_total: contratos[String(r.cd_pessoa || '').trim()]?.total ?? 0,
    }));

    const faturamento_atribuido_clientes = rows.reduce((s, r) => s + r.receita, 0);
    const fiscal_by_empresa = Object.entries(fiscalByEmpresa).map(([cd_empresa, v]) => ({
      cd_empresa: Number(cd_empresa),
      ...v,
    }));
    const faturamento_fiscal_total = fiscal_by_empresa.reduce((s, r) => s + r.faturamento_fiscal, 0);
    const faturamento_sem_cliente = fiscal_by_empresa.reduce((s, r) => s + r.faturamento_sem_cliente, 0);
    const nfs_sem_cliente = fiscal_by_empresa.reduce((s, r) => s + r.nfs_sem_cliente, 0);

    return Response.json({
      success: true,
      rows,
      total: rows.length,
      // Alias legado: mantém compatibilidade, mas agora o nome correto vem logo abaixo.
      receita_total: faturamento_atribuido_clientes,
      faturamento_atribuido_clientes,
      faturamento_fiscal_total,
      faturamento_sem_cliente,
      nfs_sem_cliente,
      fiscal_by_empresa,
      period: { start: startDate, end: endDate, end_exclusive: endDateExclusive },
      warnings,
      duration_ms: Date.now() - t0,
      sql,
      fiscal_sql: fiscalSql,
    });
  } catch (error) {
    return Response.json({ success: false, error: (error as Error)?.message || String(error) }, { status: 500 });
  }
}