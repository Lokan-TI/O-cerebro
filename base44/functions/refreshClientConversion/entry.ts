import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { buildConfig, runQuery } from '../../shared/erpConnection.ts';
import { buildConversion } from '../../shared/clientConversion.ts';
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

    // Período da coorte — mês/ano corrente calculado dinamicamente quando não informado
    const now = new Date();
    const periodStart = body?.start_date || `${now.getFullYear()}-01-01`;
    // end_date_exclusive é o contrato novo. end_date permanece como alias legado e também é exclusivo nesta função.
    const periodEnd = body?.end_date_exclusive || body?.end_date || new Date(now.getTime() + 86400000).toISOString().slice(0, 10);

    const warnings: string[] = [];
    let queryCount = 0;
    const novosSub = `SELECT p2.cd_pessoa FROM pessoa p2 WITH (NOLOCK) WHERE p2.dt_cad_pessoa >= '${periodStart}' AND p2.dt_cad_pessoa < '${periodEnd}'`;

    // 1) Coorte — novos registros na tabela pessoa
    const pessoasSql = `SELECT p.cd_pessoa, p.nm_pessoa, p.fl_tipo_pessoa, p.nr_cpf_pessoa, p.nr_cnpj_pessoa,
        p.dt_cad_pessoa, p.fl_cliente_pessoa, p.fl_ativo
      FROM pessoa p WITH (NOLOCK)
      WHERE p.dt_cad_pessoa >= '${periodStart}' AND p.dt_cad_pessoa < '${periodEnd}'`;
    const pessoas = getRows(await runQuery(source, wrap(pessoasSql), 60000));
    queryCount++;

    if (pessoas.length === 0) {
      return Response.json({ success: false, error: 'Nenhum cadastro encontrado no período selecionado.' });
    }

    // 2) Primeira ficha de locação válida por cliente (+ contagens)
    let fichas: any[] = [];
    try {
      const fichaSql = `SELECT cd_pessoa, dt_pedido, cd_controle, cd_empresa, cd_pessoa_fun, qtd, ativas FROM (
          SELECT f.cd_pessoa, f.dt_pedido, f.cd_controle, f.cd_empresa, f.cd_pessoa_fun,
            COUNT(*) OVER (PARTITION BY f.cd_pessoa) AS qtd,
            SUM(CASE WHEN f.dt_enc_ficha IS NULL THEN 1 ELSE 0 END) OVER (PARTITION BY f.cd_pessoa) AS ativas,
            ROW_NUMBER() OVER (PARTITION BY f.cd_pessoa ORDER BY f.dt_pedido, f.cd_controle) AS rn
          FROM fich_loc f WITH (NOLOCK)
          WHERE f.cd_pessoa IN (${novosSub}) AND f.dt_pedido IS NOT NULL
            ${empFilter('f')}
        ) x WHERE rn = 1`;
      fichas = getRows(await runQuery(source, wrap(fichaSql), 60000));
      queryCount++;
    } catch (e: any) {
      warnings.push('Falha ao extrair fichas de locação: ' + (e.message || String(e)).slice(0, 120));
    }

    // 3) Primeira nota fiscal válida por cliente (+ totais). Canceladas excluídas (fl_can_nf = 'S')
    let notas: any[] = [];
    try {
      const nfSql = `SELECT cd_pessoa, dt_emi_nf, nr_nf, cd_empresa, vl_primeira, vl_total, qtd FROM (
          SELECT n.cd_pessoa, n.dt_emi_nf, n.nr_nf_ini AS nr_nf, n.cd_empresa,
            n.vl_faturamento AS vl_primeira,
            SUM(ISNULL(n.vl_faturamento,0)) OVER (PARTITION BY n.cd_pessoa) AS vl_total,
            COUNT(*) OVER (PARTITION BY n.cd_pessoa) AS qtd,
            ROW_NUMBER() OVER (PARTITION BY n.cd_pessoa ORDER BY n.dt_emi_nf, n.nr_nf_ini) AS rn
          FROM nf n WITH (NOLOCK)
          WHERE n.cd_pessoa IN (${novosSub}) AND n.dt_emi_nf IS NOT NULL
            AND ISNULL(n.fl_can_nf,'N') <> 'S'
            ${empFilter('n')}
        ) x WHERE rn = 1`;
      notas = getRows(await runQuery(source, wrap(nfSql), 60000));
      queryCount++;
    } catch (e: any) {
      warnings.push('Falha ao extrair notas fiscais: ' + (e.message || String(e)).slice(0, 120));
    }

    // 4) Notas canceladas por cliente (para o status NOTA FISCAL CANCELADA)
    let notasCanceladas: any[] = [];
    try {
      const cancSql = `SELECT n.cd_pessoa, COUNT(*) AS qtd
        FROM nf n WITH (NOLOCK)
        WHERE n.cd_pessoa IN (${novosSub}) AND n.fl_can_nf = 'S'
          ${empFilter('n')}
        GROUP BY n.cd_pessoa`;
      notasCanceladas = getRows(await runQuery(source, wrap(cancSql), 60000));
      queryCount++;
    } catch (e: any) {
      warnings.push('Falha ao extrair notas canceladas: ' + (e.message || String(e)).slice(0, 120));
    }

    // 5) Nomes de vendedores e empresas
    const vendorNames: Record<string, string> = {};
    const vendIds = [...new Set(fichas.map((f: any) => Number(f.cd_pessoa_fun)).filter(Boolean))];
    for (let i = 0; i < vendIds.length; i += 200) {
      const batch = vendIds.slice(i, i + 200);
      try {
        const sql = `SELECT cd_pessoa, COALESCE(NULLIF(nm_fan_pessoa,''), nm_pessoa) AS nome FROM pessoa WITH (NOLOCK) WHERE cd_pessoa IN (${batch.join(',')})`;
        for (const r of getRows(await runQuery(source, wrap(sql), 30000))) {
          vendorNames[Number(r.cd_pessoa)] = String(r.nome || '');
        }
        queryCount++;
      } catch { warnings.push('Falha ao resolver nomes de vendedores.'); }
    }

    const empresaNames: Record<string, string> = {};
    try {
      for (const r of getRows(await runQuery(source, wrap('SELECT cd_empresa, nm_fan_empresa FROM empresa WITH (NOLOCK) WHERE cd_empresa <= 50'), 30000))) {
        empresaNames[Number(r.cd_empresa)] = String(r.nm_fan_empresa || '');
      }
      queryCount++;
    } catch { warnings.push('Falha ao resolver nomes de empresas.'); }

    // 6) Camada analítica
    const analytics = buildConversion({
      pessoas, fichas, notas, notasCanceladas, vendorNames, empresaNames,
      sourceName: (source.name || 'ERP').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12),
      periodStart, periodEnd,
    });

    // 7) Publicação versionada (a versão anterior só sai do ar após a nova ser criada)
    const pad = (n: number) => String(n).padStart(2, '0');
    const slug = (source.name || 'ERP').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
    const version = `CONV-${slug}-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

    const snapshot = await base44.asServiceRole.entities.ClientConversionSnapshot.create({
      source_id: sourceId,
      source_name: source.name,
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

    await base44.asServiceRole.entities.ClientConversionSnapshot.updateMany(
      { source_id: sourceId, is_current: true },
      { $set: { is_current: false } }
    );
    await base44.asServiceRole.entities.ClientConversionSnapshot.update(snapshot.id, { is_current: true });

    return Response.json({
      success: true,
      version,
      warnings,
      kpis: analytics.kpis,
      duration_ms: Date.now() - startTime,
    });
  } catch (error: any) {
    return Response.json({ success: false, error: (error.message || String(error)).slice(0, 400) }, { status: 500 });
  }
});