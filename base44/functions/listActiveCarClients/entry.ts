import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { buildConfig, runQuery } from '../../shared/erpConnection.ts';

function getRows(result) {
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
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const sourceId = body?.source_id;
    if (!sourceId) return Response.json({ success: false, error: 'source_id é obrigatório.' });

    const source = await base44.asServiceRole.entities.ErpDataSource.get(sourceId);
    if (!source) return Response.json({ success: false, error: 'Fonte de dados não encontrada.' });

    const now = new Date();
    const year = now.getFullYear();
    const startDate = body?.start_date || `${year}-01-01`;
    const endDate = body?.end_date || `${year + 1}-01-01`;
    const onlyOpen = body?.only_open === true;

    const config = buildConfig(source);
    if (!config) throw new Error('Configuração de conexão incompleta para a fonte.');

    const wrap = (inner) => config.clientId
      ? `EXEC DW_API '${config.clientId}', '${inner.replace(/'/g, "''")}'`
      : inner;

    // Aggregate CAR by client (sargable date filter on dt_emi_car)
    const carSql = `SELECT
      cd_pessoa_cli,
      cd_empresa_gestora,
      COUNT(*) AS qtd_car,
      ISNULL(SUM(vl_pre_car), 0) AS vl_total,
      ISNULL(SUM(CASE WHEN dt_bai_car IS NULL AND dt_cancelamento IS NULL THEN vl_pre_car ELSE 0 END), 0) AS vl_em_aberto,
      ISNULL(SUM(CASE WHEN dt_bai_car IS NOT NULL THEN vl_pre_car ELSE 0 END), 0) AS vl_baixado,
      COUNT(CASE WHEN dt_bai_car IS NULL AND dt_cancelamento IS NULL THEN 1 END) AS qtd_em_aberto,
      MIN(dt_emi_car) AS primeira_emi,
      MAX(dt_emi_car) AS ultima_emi,
      MIN(dt_ven_car) AS primeiro_venc,
      MAX(dt_ven_car) AS ultimo_venc
    FROM car WITH (NOLOCK)
    WHERE dt_emi_car >= '${startDate}' AND dt_emi_car < '${endDate}'
      AND dt_cancelamento IS NULL
    GROUP BY cd_pessoa_cli, cd_empresa_gestora
    ORDER BY ISNULL(SUM(vl_pre_car), 0) DESC`;

    const carRes = await runQuery(source, wrap(carSql));
    const carRows = getRows(carRes);

    if (carRows.length === 0) {
      return Response.json({
        success: true,
        clients: [],
        total_clients: 0,
        total_value: 0,
        total_open: 0,
        date_range: { start: startDate, end: endDate }
      });
    }

    // Get client names (batch query)
    const clientCodes = [...new Set(carRows.map(r => Number(r.cd_pessoa_cli)))].filter(Boolean);
    let nameMap = {};
    const docMap = {};
    if (clientCodes.length > 0) {
      try {
        // Batch in groups of 200 to avoid query length limits
        for (let i = 0; i < clientCodes.length; i += 200) {
          const batch = clientCodes.slice(i, i + 200);
          const namesSql = `SELECT cd_pessoa, nm_pessoa, nr_cnpj_pessoa, nr_cpf_pessoa FROM pessoa WITH (NOLOCK) WHERE cd_pessoa IN (${batch.join(',')})`;
          const namesRes = await runQuery(source, wrap(namesSql));
          for (const r of getRows(namesRes)) {
            nameMap[Number(r.cd_pessoa)] = String(r.nm_pessoa || '');
            docMap[Number(r.cd_pessoa)] = String(r.nr_cnpj_pessoa || r.nr_cpf_pessoa || '');
          }
        }
      } catch (e) {
        // Continue without names if query fails
      }
    }

    // Build client list
    let clients = carRows.map(r => {
      const vlTotal = Number(r.vl_total) || 0;
      const vlEmAberto = Number(r.vl_em_aberto) || 0;
      const vlBaixado = Number(r.vl_baixado) || 0;
      return {
        cd_pessoa: Number(r.cd_pessoa_cli),
        nm_pessoa: nameMap[Number(r.cd_pessoa_cli)] || `Cliente ${r.cd_pessoa_cli}`,
        documento: docMap[Number(r.cd_pessoa_cli)] || '',
        cd_empresa: Number(r.cd_empresa_gestora) || null,
        qtd_car: Number(r.qtd_car) || 0,
        qtd_em_aberto: Number(r.qtd_em_aberto) || 0,
        vl_total: vlTotal,
        vl_em_aberto: vlEmAberto,
        vl_baixado: vlBaixado,
        primeira_emi: r.primeira_emi ? new Date(r.primeira_emi).toISOString().slice(0, 10) : null,
        ultima_emi: r.ultima_emi ? new Date(r.ultima_emi).toISOString().slice(0, 10) : null,
        primeiro_venc: r.primeiro_venc ? new Date(r.primeiro_venc).toISOString().slice(0, 10) : null,
        ultimo_venc: r.ultimo_venc ? new Date(r.ultimo_venc).toISOString().slice(0, 10) : null,
      };
    });

    // Filter: only clients with open CAR if requested
    if (onlyOpen) {
      clients = clients.filter(c => c.qtd_em_aberto > 0);
    }

    const totalValue = clients.reduce((s, c) => s + c.vl_total, 0);
    const totalOpen = clients.reduce((s, c) => s + c.vl_em_aberto, 0);

    return Response.json({
      success: true,
      clients,
      total_clients: clients.length,
      total_value: totalValue,
      total_open: totalOpen,
      date_range: { start: startDate, end: endDate },
      queries: [
        { label: 'CAR agregado por cliente', description: 'car — período e empresa gestora', sql: carSql },
        { label: 'Nomes e documentos dos clientes', description: 'pessoa — resolvido em lotes de 200 códigos', sql: `SELECT cd_pessoa, nm_pessoa, nr_cnpj_pessoa, nr_cpf_pessoa FROM pessoa WITH (NOLOCK) WHERE cd_pessoa IN (...)` },
      ],
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message || String(error) }, { status: 500 });
  }
});