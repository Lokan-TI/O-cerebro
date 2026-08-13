import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { buildConfig, runQuery } from '../../shared/erpConnection.ts';
import { approvedRemessaFrom, faturaFrom } from '../../shared/churnUniverse.ts';

// Motor de classificação de clientes em 9 status de ciclo de vida.
// Universo = clientes com remessa realizada (fl_remessa.dt_saida) OU ficha de locação (fich_loc).
// Janelas: A = análise [aStart,aEnd); R = referência [rStart,aStart) (ano anterior por padrão).
//
// Status (mutuamente exclusivos):
//  1. Novo ativo       — primeira remessa realizada dentro de A.
//  2. Recorrente       — ativo em A e em R.
//  3. Reativado        — ativo em A, não em R, com histórico anterior (retornou).
//  4. Em risco         — inativo em A, ativo em R, última remessa nos últimos 3 meses de R (dropoff recente).
//  5. Em churn         — inativo em A, ativo em R, última remessa antes dos últimos 3 meses de R.
//  6. Dormente         — inativo em A e R, última remessa entre 2 anos e o início de R.
//  7. Churn confirmado — última remessa há mais de 2 anos (antes da janela dormente).
//  8. Prospector       — ficha de locação sem remessa realizada, ficha antiga (> 3 meses).
//  9. Novo cadastro    — ficha de locação sem remessa realizada, ficha recente (≤ 3 meses).

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

function isoDate(d) { return d.toISOString().slice(0, 10); }

export const CLIENT_STATUSES = [
  'Novo ativo', 'Recorrente', 'Reativado', 'Em risco', 'Em churn',
  'Dormente', 'Churn confirmado', 'Prospector', 'Novo cadastro',
];

function classify(c, ctx) {
  const { aStart, riskCutoff, dormantStart } = ctx;
  const cntA = c.cnt_a || 0;
  const cntR = c.cnt_r || 0;
  const first = c.first_remessa ? new Date(c.first_remessa) : null;
  const last = c.last_remessa ? new Date(c.last_remessa) : null;

  if (c.has_remessa) {
    if (cntA > 0 && first && isoDate(first) >= aStart) return 'Novo ativo';
    if (cntA > 0 && cntR > 0) return 'Recorrente';
    if (cntA > 0 && cntR === 0) return 'Reativado';
    if (cntA === 0 && cntR > 0 && last && isoDate(last) >= riskCutoff) return 'Em risco';
    if (cntA === 0 && cntR > 0) return 'Em churn';
    if (cntA === 0 && cntR === 0 && last && isoDate(last) >= dormantStart) return 'Dormente';
    return 'Churn confirmado';
  }
  // ficha sem remessa realizada
  if (c.min_ficha && isoDate(new Date(c.min_ficha)) >= ctx.novoCadastroCutoff) return 'Novo cadastro';
  return 'Prospector';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') {
      return Response.json({ success: false, error: 'Apenas administradores podem classificar clientes.' }, { status: 403 });
    }

    const body = await req.json();
    const sourceId = body?.source_id;
    if (!sourceId) return Response.json({ success: false, error: 'source_id é obrigatório.' });

    const source = await base44.asServiceRole.entities.ErpDataSource.get(sourceId);
    if (!source) return Response.json({ success: false, error: 'Fonte de dados não encontrada.' });

    const config = buildConfig(source);
    if (!config) throw new Error('Configuração de conexão incompleta para a fonte.');

    const wrap = (inner) => config.clientId
      ? `EXEC DW_API '${config.clientId}', '${inner.replace(/'/g, "''")}'`
      : inner;

    const now = new Date();
    const y = now.getFullYear();
    const aStart = body?.analysis_start || `${y}-01-01`;
    const aEnd = body?.analysis_end || `${y + 1}-01-01`;
    const rStart = body?.ref_start || `${y - 1}-01-01`;

    // Cortes derivados
    const riskCutoffD = new Date(aStart); riskCutoffD.setMonth(riskCutoffD.getMonth() - 3);
    const dormantStartD = new Date(aEnd); dormantStartD.setMonth(dormantStartD.getMonth() - 24);
    const novoCadastroD = new Date(aEnd); novoCadastroD.setMonth(novoCadastroD.getMonth() - 3);
    const fichaLowerD = new Date(aEnd); fichaLowerD.setFullYear(fichaLowerD.getFullYear() - 3);
    const remessaLowerD = new Date(aEnd); remessaLowerD.setFullYear(remessaLowerD.getFullYear() - 5);
    const ctx = {
      aStart, rStart,
      riskCutoff: isoDate(riskCutoffD),
      dormantStart: isoDate(dormantStartD),
      novoCadastroCutoff: isoDate(novoCadastroD),
    };

    const warnings = [];
    const queries: any[] = [];
    let queryCount = 0;
    const t0 = Date.now();

    // 1. Remessas realizadas por cliente (10 anos)
    const clients = {}; // cd_pessoa -> aggregate
    try {
      const sql = `SELECT f.cd_pessoa,
        MIN(r.dt_saida) AS first_remessa,
        MAX(r.dt_saida) AS last_remessa,
        SUM(CASE WHEN r.dt_saida >= '${aStart}' AND r.dt_saida < '${aEnd}' THEN 1 ELSE 0 END) AS cnt_a,
        SUM(CASE WHEN r.dt_saida >= '${rStart}' AND r.dt_saida < '${aStart}' THEN 1 ELSE 0 END) AS cnt_r
        ${approvedRemessaFrom}
          AND r.dt_saida >= '${isoDate(remessaLowerD)}'
        GROUP BY f.cd_pessoa`;
      queries.push({ label: 'Remessas realizadas por cliente', description: 'fl_remessa aprovada — contagem nas janelas de análise e referência', sql });
      for (const r of getRows(await runQuery(source, wrap(sql), 60000))) {
        const code = String(r.cd_pessoa);
        clients[code] = {
          cd_pessoa: code,
          has_remessa: true,
          first_remessa: r.first_remessa,
          last_remessa: r.last_remessa,
          cnt_a: Number(r.cnt_a) || 0,
          cnt_r: Number(r.cnt_r) || 0,
        };
        }
      queryCount++;
    } catch (e) { warnings.push('remessa: ' + (e.message || '').slice(0, 100)); }

    // 2. Fichas de locação por cliente (sem remessa realizada → Prospector/Novo cadastro)
    try {
      const sql = `SELECT cd_pessoa, MIN(dt_pedido) AS min_ficha
        FROM fich_loc WITH (NOLOCK)
        WHERE cd_pessoa IS NOT NULL AND cd_pessoa <> ''
          AND dt_pedido >= '${isoDate(fichaLowerD)}'
        GROUP BY cd_pessoa`;
      queries.push({ label: 'Fichas de locação por cliente', description: 'fich_loc — base de Prospector / Novo cadastro', sql });
      for (const r of getRows(await runQuery(source, wrap(sql), 30000))) {
        const code = String(r.cd_pessoa);
        if (!clients[code]) {
          clients[code] = { cd_pessoa: code, has_remessa: false, min_ficha: r.min_ficha };
        }
      }
      queryCount++;
    } catch (e) { warnings.push('fich_loc: ' + (e.message || '').slice(0, 100)); }

    // 3. Receita por cliente no período A (fl_fatura)
    const revenue = {};
    try {
      const sql = `SELECT f.cd_pessoa, ISNULL(SUM(fat.vl_fatura),0) AS rev
        ${faturaFrom}
          AND fat.dt_geracao >= '${aStart}' AND fat.dt_geracao < '${aEnd}'
        GROUP BY f.cd_pessoa`;
      queries.push({ label: 'Receita por cliente na janela de análise', description: 'fl_fatura — soma de vl_fatura', sql });
      for (const r of getRows(await runQuery(source, wrap(sql), 30000))) {
        revenue[String(r.cd_pessoa)] = Number(r.rev) || 0;
      }
      queryCount++;
    } catch (e) { warnings.push('receita: ' + (e.message || '').slice(0, 100)); }

    // 4. Classificação
    const distribution = {};
    for (const s of CLIENT_STATUSES) distribution[s] = { count: 0, revenue: 0 };
    const clientList = [];
    for (const c of Object.values(clients)) {
      const status = classify(c, ctx);
      const rev = revenue[c.cd_pessoa] || 0;
      distribution[status].count++;
      distribution[status].revenue += rev;
      clientList.push({
        cd_pessoa: c.cd_pessoa,
        status,
        has_remessa: !!c.has_remessa,
        first_remessa: c.first_remessa ? new Date(c.first_remessa).toISOString().slice(0, 10) : null,
        last_remessa: c.last_remessa ? new Date(c.last_remessa).toISOString().slice(0, 10) : null,
        cnt_a: c.cnt_a || 0,
        cnt_r: c.cnt_r || 0,
        min_ficha: c.min_ficha ? new Date(c.min_ficha).toISOString().slice(0, 10) : null,
        revenue: rev,
      });
    }

    // Distribuição ordenada + clients top 1000 por receita (antes da resolução de nomes)
    const distArr = CLIENT_STATUSES.map((s) => ({ status: s, count: distribution[s].count, revenue: distribution[s].revenue }));
    const totalClients = clientList.length;
    const topClients = clientList.sort((a, b) => (b.revenue - a.revenue) || (b.cnt_a - a.cnt_a)).slice(0, 1000);

    // 5. Resolução de nomes (batch) — apenas para os 1000 clientes retornados
    const nameMap = {};
    for (let i = 0; i < topClients.length; i += 200) {
      const batch = topClients.slice(i, i + 200).map((c) => c.cd_pessoa);
      try {
        const namesSql = `SELECT cd_pessoa, COALESCE(NULLIF(nm_fan_pessoa,''), nm_pessoa) AS nome FROM pessoa WITH (NOLOCK) WHERE cd_pessoa IN (${batch.join(',')})`;
        for (const r of getRows(await runQuery(source, wrap(namesSql)))) {
          nameMap[String(r.cd_pessoa)] = String(r.nome || '');
        }
      } catch {}
    }
    for (const c of topClients) c.nm_pessoa = nameMap[c.cd_pessoa] || `Cliente ${c.cd_pessoa}`;

    return Response.json({
      success: true,
      date_range: { analysis_start: aStart, analysis_end: aEnd, ref_start: rStart },
      total_clients: totalClients,
      distribution: distArr,
      clients: topClients,
      query_count: queryCount,
      duration_ms: Date.now() - t0,
      warnings,
      queries: [
        ...queries,
        { label: 'Nomes dos clientes', description: 'pessoa — resolvido em lotes de 200 códigos', sql: `SELECT cd_pessoa, COALESCE(NULLIF(nm_fan_pessoa,''), nm_pessoa) AS nome FROM pessoa WITH (NOLOCK) WHERE cd_pessoa IN (...)` },
      ],
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message || String(error) }, { status: 500 });
  }
});