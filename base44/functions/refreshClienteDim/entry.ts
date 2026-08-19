import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { buildConfig, runQuery } from '../../shared/erpConnection.ts';
import { buildClienteDim } from '../../shared/clienteDim.ts';
import { empFilter } from '../../shared/empresaScope.ts';

function getRows(result: any) {
  if (!result) return [];
  if (Array.isArray(result.recordset) && result.recordset.length > 0) return result.recordset;
  if (Array.isArray(result.recordsets)) {
    for (let i = result.recordsets.length - 1; i >= 0; i--) {
      if (Array.isArray(result.recordsets[i]) && result.recordsets[i].length > 0) return result.recordsets[i];
    }
  }
  if (Array.isArray(result)) return result;
  return [];
}

Deno.serve(async (req) => {
  const startTime = Date.now();
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') {
      return Response.json({ success: false, error: 'Apenas administradores podem atualizar dados.' }, { status: 403 });
    }

    const body = await req.json();
    const sourceId = body?.source_id;
    if (!sourceId) return Response.json({ success: false, error: 'source_id é obrigatório.' });

    const source = await base44.asServiceRole.entities.ErpDataSource.get(sourceId);
    if (!source) return Response.json({ success: false, error: 'Fonte de dados não encontrada.' });

    const config = buildConfig(source);
    if (!config) return Response.json({ success: false, error: 'Configuração de conexão incompleta.' });
    const wrap = (inner: string) => config.clientId
      ? `EXEC DW_API '${config.clientId}', '${inner.replace(/'/g, "''")}'`
      : inner;

    const now = new Date();
    const periodStart = body?.start_date || `${now.getFullYear() - 2}-01-01`;
    const periodEnd = body?.end_date || new Date(now.getTime() + 86400000).toISOString().slice(0, 10);

    const warnings: string[] = [];
    let queryCount = 0;

    // 1) Faturamento por cliente/empresa (nf) — canceladas excluídas
    let notas: any[] = [];
    try {
      const sql = `SELECT n.cd_pessoa, n.cd_empresa, COUNT(*) AS qtd,
          SUM(ISNULL(n.vl_faturamento,0)) AS valor,
          MIN(n.dt_emi_nf) AS primeira, MAX(n.dt_emi_nf) AS ultima
        FROM nf n WITH (NOLOCK)
        WHERE n.dt_emi_nf >= '${periodStart}' AND n.dt_emi_nf < '${periodEnd}'
          AND ISNULL(n.fl_can_nf,'N') <> 'S' AND n.cd_pessoa IS NOT NULL ${empFilter('n')}
        GROUP BY n.cd_pessoa, n.cd_empresa`;
      notas = getRows(await runQuery(source, wrap(sql), 60000));
      queryCount++;
    } catch (e: any) {
      warnings.push('Falha ao agregar notas fiscais: ' + (e.message || String(e)).slice(0, 120));
    }

    // 2) Locações por cliente/empresa (fich_loc)
    let fichas: any[] = [];
    try {
      const sql = `SELECT f.cd_pessoa, f.cd_empresa, COUNT(*) AS qtd,
          SUM(CASE WHEN f.dt_enc_ficha IS NULL THEN 1 ELSE 0 END) AS abertas,
          MIN(f.dt_pedido) AS primeira, MAX(f.dt_pedido) AS ultima
        FROM fich_loc f WITH (NOLOCK)
        WHERE f.dt_pedido >= '${periodStart}' AND f.dt_pedido < '${periodEnd}' AND f.cd_pessoa IS NOT NULL ${empFilter('f')}
        GROUP BY f.cd_pessoa, f.cd_empresa`;
      fichas = getRows(await runQuery(source, wrap(sql), 60000));
      queryCount++;
    } catch (e: any) {
      warnings.push('Falha ao agregar fichas de locação: ' + (e.message || String(e)).slice(0, 120));
    }

    // 3) Financeiro por cliente (car) — regra canônica do dicionário Sisloc:
    // valor = vl_pre + vl_acr - vl_des · fl_status: 5 provisório · 10 firme · 25/30 liquidado · 40 cancelado (excluído)
    let cars: any[] = [];
    try {
      const sql = `SELECT c.cd_pessoa_cli AS cd_pessoa, COUNT(*) AS qtd,
          SUM(CASE WHEN NOT (c.fl_status = 5 AND c.dt_bai_car IS NULL AND c.dt_ven_car >= CAST(GETDATE() AS date)) THEN v.val ELSE 0 END) AS valor_total,
          SUM(CASE WHEN c.fl_status IN (25,30) OR c.dt_bai_car IS NOT NULL THEN v.val ELSE 0 END) AS valor_liquidado,
          SUM(CASE WHEN c.fl_status = 10 AND c.dt_bai_car IS NULL AND c.dt_ven_car >= CAST(GETDATE() AS date) THEN v.val ELSE 0 END) AS valor_a_vencer,
          SUM(CASE WHEN c.fl_status IN (5,10) AND c.dt_bai_car IS NULL AND c.dt_ven_car < CAST(GETDATE() AS date) THEN v.val ELSE 0 END) AS valor_vencido,
          SUM(CASE WHEN c.fl_status = 5 AND c.dt_bai_car IS NULL AND c.dt_ven_car >= CAST(GETDATE() AS date) THEN v.val ELSE 0 END) AS valor_provisorio,
          SUM(ISNULL(c.vl_juros,0)+ISNULL(c.vl_multa,0)) AS valor_juros_multa
        FROM car c WITH (NOLOCK)
        CROSS APPLY (SELECT ROUND(COALESCE(c.vl_pre_car,0)+COALESCE(c.vl_acr_car,0)-COALESCE(c.vl_des_car,0),2) AS val) v
        WHERE c.dt_emi_car >= '${periodStart}' AND c.dt_emi_car < '${periodEnd}' AND c.cd_pessoa_cli IS NOT NULL
          AND c.fl_status <> 40 ${empFilter('c', 'cd_empresa_gestora')}
        GROUP BY c.cd_pessoa_cli`;
      cars = getRows(await runQuery(source, wrap(sql), 60000));
      queryCount++;
    } catch (e: any) {
      warnings.push('Falha ao agregar contas a receber: ' + (e.message || String(e)).slice(0, 120));
    }

    // 4) Cadastro (pessoa) — resolvido em lotes apenas para os clientes com atividade
    const ids = [...new Set([
      ...notas.map((r: any) => Number(r.cd_pessoa)),
      ...fichas.map((r: any) => Number(r.cd_pessoa)),
      ...cars.map((r: any) => Number(r.cd_pessoa)),
    ].filter(Boolean))].slice(0, 3000);

    const pessoas: any[] = [];
    for (let i = 0; i < ids.length; i += 300) {
      const batch = ids.slice(i, i + 300);
      try {
        const sql = `SELECT p.cd_pessoa, COALESCE(NULLIF(p.nm_fan_pessoa,''), p.nm_pessoa) AS nome,
            p.fl_tipo_pessoa, p.nr_cpf_pessoa, p.nr_cnpj_pessoa, p.dt_cad_pessoa, p.fl_ativo,
            p.cidade_pessoa, p.uf_pessoa
          FROM pessoa p WITH (NOLOCK) WHERE p.cd_pessoa IN (${batch.join(',')})`;
        pessoas.push(...getRows(await runQuery(source, wrap(sql), 45000)));
        queryCount++;
      } catch {
        warnings.push('Falha ao resolver cadastro de um lote de clientes.');
      }
    }

    // 5) Empresas
    const empresaNames: Record<string, string> = {};
    try {
      for (const r of getRows(await runQuery(source, wrap('SELECT cd_empresa, nm_fan_empresa FROM empresa WITH (NOLOCK) WHERE cd_empresa <= 50'), 30000))) {
        empresaNames[String(Number(r.cd_empresa))] = String(r.nm_fan_empresa || '');
      }
      queryCount++;
    } catch { warnings.push('Falha ao resolver nomes de empresas.'); }

    const sourceSlug = (source.name || 'ERP').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
    const analytics = buildClienteDim({ pessoas, fichas, notas, cars, empresaNames, sourceSlug, periodStart, periodEnd });

    const pad = (n: number) => String(n).padStart(2, '0');
    const version = `DIM-${sourceSlug}-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

    const snapshot = await base44.asServiceRole.entities.ClienteDimSnapshot.create({
      source_id: sourceId,
      source_name: source.name,
      source_slug: sourceSlug,
      version,
      is_current: false,
      created_at: new Date().toISOString(),
      generated_by_name: user.full_name || user.email,
      period_start: periodStart,
      period_end: periodEnd,
      duration_ms: Date.now() - startTime,
      query_count: queryCount,
      warnings: warnings.slice(0, 20),
      ...analytics,
    });

    await base44.asServiceRole.entities.ClienteDimSnapshot.updateMany(
      { source_id: sourceId, is_current: true },
      { $set: { is_current: false } }
    );
    await base44.asServiceRole.entities.ClienteDimSnapshot.update(snapshot.id, { is_current: true });

    return Response.json({ success: true, version, warnings, kpis: analytics.kpis, duration_ms: Date.now() - startTime });
  } catch (error: any) {
    return Response.json({ success: false, error: (error.message || String(error)).slice(0, 400) }, { status: 500 });
  }
});