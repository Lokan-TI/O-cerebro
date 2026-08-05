import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { buildConfig, runQuery } from '../../shared/erpConnection.ts';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

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

    const refStart = body?.ref_start;
    const refEnd = body?.ref_end;
    const analysisStart = body?.analysis_start;
    const analysisEnd = body?.analysis_end;

    if (!dateRegex.test(refStart || '') || !dateRegex.test(refEnd || '') ||
        !dateRegex.test(analysisStart || '') || !dateRegex.test(analysisEnd || '')) {
      return Response.json({ success: false, error: 'Datas devem estar no formato YYYY-MM-DD.' });
    }

    const config = buildConfig(source);
    if (!config) throw new Error('Configuração de conexão incompleta.');

    const wrap = (inner) => config.clientId
      ? `EXEC DW_API '${config.clientId}', '${inner.replace(/'/g, "''")}'`
      : inner;

    // Detect cancel filter
    let cancelFilter = '';
    try {
      const checkRes = await runQuery(source, wrap("SELECT TOP 1 fl_can_nf AS v FROM nf WHERE fl_can_nf IS NOT NULL"));
      const checkRow = getRows(checkRes)[0];
      if (checkRow && checkRow.v != null) {
        if (typeof checkRow.v === 'string') cancelFilter = "AND fl_can_nf <> 'S'";
        else cancelFilter = 'AND fl_can_nf = 0';
      }
    } catch {}

    // Churn: clients who purchased in ref period but NOT in analysis period
    const churnSql = `WITH ref_clients AS (
      SELECT cd_pessoa,
             ISNULL(SUM(vl_faturamento),0) AS ref_revenue,
             COUNT(*) AS ref_nfs,
             MIN(dt_emi_nf) AS ref_first_nf,
             MAX(dt_emi_nf) AS ref_last_nf
      FROM nf WITH (NOLOCK)
      WHERE dt_emi_nf >= '${refStart}' AND dt_emi_nf < '${refEnd}' ${cancelFilter}
        AND cd_pessoa IS NOT NULL AND cd_pessoa <> ''
      GROUP BY cd_pessoa
    ),
    analysis_clients AS (
      SELECT cd_pessoa,
             ISNULL(SUM(vl_faturamento),0) AS analysis_revenue,
             COUNT(*) AS analysis_nfs,
             MAX(dt_emi_nf) AS analysis_last_nf
      FROM nf WITH (NOLOCK)
      WHERE dt_emi_nf >= '${analysisStart}' AND dt_emi_nf < '${analysisEnd}' ${cancelFilter}
        AND cd_pessoa IS NOT NULL AND cd_pessoa <> ''
      GROUP BY cd_pessoa
    )
    SELECT
      r.cd_pessoa,
      r.ref_revenue,
      r.ref_nfs,
      r.ref_first_nf,
      r.ref_last_nf,
      COALESCE(a.analysis_revenue, 0) AS analysis_revenue,
      COALESCE(a.analysis_nfs, 0) AS analysis_nfs,
      a.analysis_last_nf,
      CASE WHEN a.cd_pessoa IS NULL THEN 1 ELSE 0 END AS is_churned
    FROM ref_clients r
    LEFT JOIN analysis_clients a ON r.cd_pessoa = a.cd_pessoa
    ORDER BY r.ref_revenue DESC`;

    const result = await runQuery(source, wrap(churnSql), 25000);
    const rows = getRows(result);

    const totalRef = rows.length;
    const churnedRows = rows.filter(r => Number(r.is_churned) === 1);
    const activeRows = rows.filter(r => Number(r.is_churned) === 0);
    const revenueAtRisk = churnedRows.reduce((s, r) => s + (Number(r.ref_revenue) || 0), 0);
    const activeRevenue = activeRows.reduce((s, r) => s + (Number(r.ref_revenue) || 0), 0);
    const churnRate = totalRef > 0 ? (churnedRows.length / totalRef * 100) : 0;

    // Monthly churn: when did churned clients last purchase?
    const monthlyChurn = {};
    for (const r of churnedRows) {
      if (r.ref_last_nf) {
        const d = new Date(r.ref_last_nf);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthlyChurn[key] = (monthlyChurn[key] || 0) + 1;
      }
    }
    const monthlyChurnArray = Object.entries(monthlyChurn)
      .map(([k, v]) => {
        const [y, m] = k.split('-');
        return { ano: Number(y), mes: Number(m), churned: v };
      })
      .sort((a, b) => a.ano === b.ano ? a.mes - b.mes : a.ano - b.ano);

    // ---- Detailed enrichment for ALL churned clients (batched to respect DW_API 8000 char limit) ----
    const detailClients = churnedRows;
    const pessoaCodes = detailClients.map(r => r.cd_pessoa).filter(v => v != null && v !== '');
    const buildCodesList = (codes) => codes.map(c => {
      const n = Number(c);
      return isNaN(n) ? `'${String(c).replace(/'/g, "''")}'` : String(n);
    }).join(',');
    const BATCH = 500;

    const pessoaMap = {};
    const fichlocMap = {};
    const movitemMap = {};

    if (pessoaCodes.length > 0) {
      // 1. Client master data (pessoa): name, CPF/CNPJ, phone, email, region — batched
      try {
        for (let i = 0; i < pessoaCodes.length; i += BATCH) {
          const codesList = buildCodesList(pessoaCodes.slice(i, i + BATCH));
          const pessoaSql = `SELECT cd_pessoa, nm_pessoa, fl_tipo_pessoa, nr_cpf_pessoa, nr_cnpj_pessoa,
            en_mail_pessoa, tel_pessoa, tl_res_pessoa, tl_cel_pessoa, uf_pessoa, cidade_pessoa
            FROM pessoa WITH (NOLOCK) WHERE cd_pessoa IN (${codesList})`;
          for (const p of getRows(await runQuery(source, wrap(pessoaSql), 20000))) {
            pessoaMap[String(p.cd_pessoa)] = p;
          }
        }
      } catch {}

      // 2. Rental contracts (fich_loc): contract period, renewals, closing value — batched
      try {
        for (let i = 0; i < pessoaCodes.length; i += BATCH) {
          const codesList = buildCodesList(pessoaCodes.slice(i, i + BATCH));
          const fichSql = `SELECT cd_pessoa,
            MIN(dt_pedido) AS prim_dt_pedido,
            MAX(dt_pedido) AS ult_dt_pedido,
            MAX(dt_enc_ficha) AS ult_dt_enc_ficha,
            COUNT(*) AS total_contratos,
            SUM(CASE WHEN fl_rep_ficha = 'S' THEN 1 ELSE 0 END) AS qtd_renovacoes,
            ISNULL(SUM(vl_encerramento),0) AS total_encerramento
            FROM fich_loc WITH (NOLOCK)
            WHERE cd_pessoa IN (${codesList})
            GROUP BY cd_pessoa`;
          for (const f of getRows(await runQuery(source, wrap(fichSql), 20000))) {
            fichlocMap[String(f.cd_pessoa)] = f;
          }
        }
      } catch {}

      // 3. Rented products (nfmerc): split JOIN into two simple queries to avoid timeout.
      //    Step A: cd_nf → cd_pessoa mapping for ALL churned clients in ref period — batched
      //    Step B: nfmerc by cd_nf IN (...) — uses index on cd_nf (key field).
      try {
        const nfToPessoa = {};
        for (let i = 0; i < pessoaCodes.length; i += BATCH) {
          const codesList = buildCodesList(pessoaCodes.slice(i, i + BATCH));
          const nfMapSql = `SELECT cd_nf, cd_pessoa FROM nf WITH (NOLOCK)
            WHERE cd_pessoa IN (${codesList})
            AND dt_emi_nf >= '${refStart}' AND dt_emi_nf < '${refEnd}' ${cancelFilter}`;
          for (const r of getRows(await runQuery(source, wrap(nfMapSql), 20000))) {
            nfToPessoa[String(r.cd_nf)] = String(r.cd_pessoa);
          }
        }
        const nfCodes = Object.keys(nfToPessoa);
        if (nfCodes.length > 0) {
          const agg = {};
          for (let i = 0; i < nfCodes.length; i += BATCH) {
            const nfList = nfCodes.slice(i, i + BATCH).map(c => {
              const n = Number(c);
              return isNaN(n) ? `'${c.replace(/'/g, "''")}'` : String(n);
            }).join(',');
            const prodSql = `SELECT cd_nf,
              CAST(ds_mer_nfmerc AS nvarchar(500)) AS ds_mer_nfmerc,
              cd_equipto,
              SUM(qt_nfmerc) AS qt,
              SUM(qt_nfmerc * vl_uni_nfmerc) AS valor
              FROM nfmerc WITH (NOLOCK)
              WHERE cd_nf IN (${nfList})
                AND CAST(ds_mer_nfmerc AS nvarchar(500)) <> ''
              GROUP BY cd_nf, CAST(ds_mer_nfmerc AS nvarchar(500)), cd_equipto`;
            for (const r of getRows(await runQuery(source, wrap(prodSql), 20000))) {
              const key = nfToPessoa[String(r.cd_nf)];
              if (!key) continue;
              if (!agg[key]) agg[key] = { produtos: [], codigos: [], total_qt: 0, total_valor: 0 };
              agg[key].produtos.push(r.ds_mer_nfmerc);
              if (r.cd_equipto != null) agg[key].codigos.push(String(r.cd_equipto));
              agg[key].total_qt += Number(r.qt) || 0;
              agg[key].total_valor += Number(r.valor) || 0;
            }
          }
          for (const [k, v] of Object.entries(agg)) {
            movitemMap[k] = {
              produtos_locados: [...new Set(v.produtos)].join(', '),
              codigos_equipto: [...new Set(v.codigos)].join(', '),
              total_qt: v.total_qt,
              total_valor: v.total_valor,
            };
          }
        }
      } catch {}
    }

    return Response.json({
      success: true,
      summary: {
        total_ref_clients: totalRef,
        active_clients: activeRows.length,
        churned_clients: churnedRows.length,
        churn_rate: churnRate,
        revenue_at_risk: revenueAtRisk,
        active_revenue: activeRevenue,
        avg_churned_revenue: churnedRows.length > 0 ? revenueAtRisk / churnedRows.length : 0,
      },
      churned_clients: detailClients.map(r => {
        const p = pessoaMap[String(r.cd_pessoa)] || {};
        const f = fichlocMap[String(r.cd_pessoa)] || {};
        const m = movitemMap[String(r.cd_pessoa)] || {};
        return {
          cd_pessoa: String(r.cd_pessoa || ''),
          nm_pessoa: p.nm_pessoa || null,
          fl_tipo_pessoa: p.fl_tipo_pessoa || null,
          nr_cpf_pessoa: p.nr_cpf_pessoa || null,
          nr_cnpj_pessoa: p.nr_cnpj_pessoa || null,
          en_mail_pessoa: p.en_mail_pessoa || null,
          telefone: p.tl_cel_pessoa || p.tl_res_pessoa || p.tel_pessoa || null,
          uf_pessoa: p.uf_pessoa || null,
          cidade_pessoa: p.cidade_pessoa || null,
          ref_revenue: Number(r.ref_revenue) || 0,
          ref_nfs: Number(r.ref_nfs) || 0,
          ref_first_nf: r.ref_first_nf ? new Date(r.ref_first_nf).toISOString().slice(0, 10) : null,
          ref_last_nf: r.ref_last_nf ? new Date(r.ref_last_nf).toISOString().slice(0, 10) : null,
          analysis_revenue: Number(r.analysis_revenue) || 0,
          analysis_nfs: Number(r.analysis_nfs) || 0,
          prim_dt_pedido: f.prim_dt_pedido ? new Date(f.prim_dt_pedido).toISOString().slice(0, 10) : null,
          ult_dt_pedido: f.ult_dt_pedido ? new Date(f.ult_dt_pedido).toISOString().slice(0, 10) : null,
          ult_dt_enc_ficha: f.ult_dt_enc_ficha ? new Date(f.ult_dt_enc_ficha).toISOString().slice(0, 10) : null,
          total_contratos: Number(f.total_contratos) || 0,
          qtd_renovacoes: Number(f.qtd_renovacoes) || 0,
          total_encerramento: Number(f.total_encerramento) || 0,
          produtos_locados: m.produtos_locados || null,
          codigos_equipto: m.codigos_equipto || null,
          total_qt_locado: Number(m.total_qt) || 0,
          total_valor_locado: Number(m.total_valor) || 0,
        };
      }),
      monthly_churn: monthlyChurnArray,
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message || String(error) }, { status: 500 });
  }
});