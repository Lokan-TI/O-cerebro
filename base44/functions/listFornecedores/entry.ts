import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { buildConfig, runQuery, closePool } from '../../shared/erpConnection.ts';

// Lista os fornecedores (pessoa.fl_fornec_pessoa = 1) com o consumo em Contas a Pagar
// (cap.cd_pessoa_cre) no período informado, incluindo dados cadastrais completos para exportação.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const sourceId = body?.source_id;
    // Sem filtro de período: considera todo o histórico do sistema.
    // Um 'start' opcional pode ser informado para restringir a janela.
    const start = /^\d{4}-\d{2}-\d{2}$/.test(body?.start || '') ? body.start : null;

    let source = null;
    if (sourceId) {
      source = await base44.asServiceRole.entities.ErpDataSource.get(sourceId);
      if (!source) return Response.json({ error: 'Fonte de dados não encontrada.' }, { status: 404 });
      if (source.is_active === false) return Response.json({ error: 'A fonte selecionada está inativa.' }, { status: 403 });
    } else {
      source = { credential_reference: 'env' };
    }

    const built = buildConfig(source);
    if (!built) return Response.json({ error: 'Configuração de conexão incompleta.' }, { status: 500 });

    const wrap = (sql: string) =>
      built.clientId ? `EXEC DW_API '${built.clientId}', '${sql.replace(/'/g, "''")}'` : sql;
    const getRows = (r: any) => r?.recordset || [];

    // 1) Cadastro completo dos fornecedores
    const cadSql = `SELECT cd_pessoa, nm_pessoa, nm_fan_pessoa,
      nr_cnpj_pessoa, nr_cpf_pessoa, nr_ies_pessoa,
      log_pessoa, num_pessoa, comple_pessoa, bairro_pessoa, cidade_pessoa, uf_pessoa, cep_pessoa,
      tel_pessoa, en_mail_pessoa, fl_ativo, dt_cad_pessoa
      FROM pessoa WITH (NOLOCK)
      WHERE fl_fornec_pessoa = 1
      ORDER BY nm_pessoa`;
    const cadRows = getRows(await runQuery(source, wrap(cadSql), 30000));

    // 2) Consumo em CAP por credor no período
    const capSql = `SELECT cd_pessoa_cre,
      COUNT(*) AS qtd,
      ISNULL(SUM(vl_pre_cap),0) AS vl_total,
      ISNULL(SUM(CASE WHEN dt_bai_cap IS NULL THEN vl_pre_cap ELSE 0 END),0) AS vl_aberto,
      ISNULL(SUM(CASE WHEN dt_bai_cap IS NOT NULL THEN vl_pre_cap ELSE 0 END),0) AS vl_baixado,
      ISNULL(SUM(CASE WHEN dt_ven_cap < GETDATE() AND dt_bai_cap IS NULL THEN vl_pre_cap ELSE 0 END),0) AS vl_vencido,
      MAX(dt_emi_cap) AS dt_ultimo,
      MIN(dt_emi_cap) AS dt_primeiro
      FROM cap WITH (NOLOCK)
      WHERE cd_pessoa_cre IS NOT NULL${start ? ` AND dt_emi_cap >= '${start}'` : ''}
      GROUP BY cd_pessoa_cre`;
    const capRows = getRows(await runQuery(source, wrap(capSql), 30000));

    const toDate = (v: any) => {
      if (!v) return '';
      const d = new Date(v);
      return isNaN(d.getTime()) ? String(v) : d.toISOString().slice(0, 10);
    };

    const capMap: Record<number, any> = {};
    for (const r of capRows) capMap[Number(r.cd_pessoa_cre)] = r;

    const suppliers = cadRows.map((p: any) => {
      const c = capMap[Number(p.cd_pessoa)] || {};
      return {
        cd_pessoa: Number(p.cd_pessoa),
        nm_pessoa: String(p.nm_pessoa || ''),
        nm_fan_pessoa: String(p.nm_fan_pessoa || ''),
        cnpj: String(p.nr_cnpj_pessoa || ''),
        cpf: String(p.nr_cpf_pessoa || ''),
        inscricao_estadual: String(p.nr_ies_pessoa || ''),
        logradouro: String(p.log_pessoa || ''),
        numero: String(p.num_pessoa || ''),
        complemento: String(p.comple_pessoa || ''),
        bairro: String(p.bairro_pessoa || ''),
        cidade: String(p.cidade_pessoa || ''),
        uf: String(p.uf_pessoa || ''),
        cep: String(p.cep_pessoa || ''),
        telefone: String(p.tel_pessoa || ''),
        email: String(p.en_mail_pessoa || ''),
        ativo: p.fl_ativo === true || p.fl_ativo === 1,
        dt_cadastro: toDate(p.dt_cad_pessoa),
        cap_qtd: Number(c.qtd) || 0,
        cap_total: Number(c.vl_total) || 0,
        cap_aberto: Number(c.vl_aberto) || 0,
        cap_baixado: Number(c.vl_baixado) || 0,
        cap_vencido: Number(c.vl_vencido) || 0,
        cap_primeiro: toDate(c.dt_primeiro),
        cap_ultimo: toDate(c.dt_ultimo),
      };
    });

    return Response.json({
      suppliers,
      period_start: start,
      period_label: start ? `desde ${start}` : 'histórico completo',
      total_fornecedores: suppliers.length,
    });
  } catch (error) {
    try {
      const body2 = await req.clone().json().catch(() => ({}));
      if (body2?.source_id) await closePool({ id: body2.source_id, credential_reference: 'entity' });
      else await closePool({ credential_reference: 'env' });
    } catch {}
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
});