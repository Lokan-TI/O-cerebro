import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { buildConfig, runQuery } from '../../shared/erpConnection.ts';

// Cadastro completo de clientes (tabela pessoa), paginado por cd_pessoa (keyset).
// Varreduras completas na tabela estouram o tempo do wrapper DW_API, então o
// front-end percorre as páginas em sequência até esgotar a base.

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

const COLS = `p.cd_pessoa, p.nm_pessoa, p.nm_fan_pessoa, p.fl_tipo_pessoa,
  p.nr_cpf_pessoa, p.nr_cnpj_pessoa, p.nr_ident_pessoa, p.nr_ies_pessoa, p.uf_ies_pessoa,
  p.dt_ani_pessoa, p.dt_cad_pessoa, p.dt_ult_atividade, p.fl_ativo,
  p.fl_cliente_pessoa, p.fl_fornec_pessoa, p.fl_funcion_pessoa,
  p.log_pessoa, p.num_pessoa, p.comple_pessoa, p.bairro_pessoa, p.cidade_pessoa, p.uf_pessoa, p.cep_pessoa, p.referen_pessoa,
  p.log_cob_pessoa, p.num_cob_pessoa, p.comple_cob_pessoa, p.bairro_cob_pessoa, p.cidade_cob_pessoa, p.uf_cob_pessoa, p.cep_cob_pessoa,
  p.tel_pessoa, p.tl_cel_pessoa, p.tl_res_pessoa, p.fax_pessoa, p.en_mail_pessoa, p.en_site_pessoa,
  p.nm_pai, p.nm_mae, p.nm_empresa, p.nm_agrupamento, p.cd_gruven, p.cd_atividade,
  p.fl_optante_simples, p.fl_contribuinte_icms, p.vl_lim_venda, p.obs_pessoa`;

function relacionamento(r: any) {
  const parts: string[] = [];
  if (r.fl_cliente_pessoa === true || r.fl_cliente_pessoa === 1 || r.fl_cliente_pessoa === 'S') parts.push('Cliente');
  if (r.fl_fornec_pessoa === true || r.fl_fornec_pessoa === 1 || r.fl_fornec_pessoa === 'S') parts.push('Fornecedor');
  if (r.fl_funcion_pessoa === true || r.fl_funcion_pessoa === 1 || r.fl_funcion_pessoa === 'S') parts.push('Funcionário');
  return parts.join(' / ') || 'Sem relacionamento';
}

const dateOnly = (v: any) => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const sourceId = body?.source_id;
    if (!sourceId) return Response.json({ success: false, error: 'source_id é obrigatório.' });

    const source = await base44.asServiceRole.entities.ErpDataSource.get(sourceId);
    if (!source) return Response.json({ success: false, error: 'Fonte de dados não encontrada.' });

    const built = buildConfig(source);
    if (!built) return Response.json({ success: false, error: 'Configuração de conexão incompleta.' });
    const wrap = (inner: string) => built.clientId
      ? `EXEC DW_API '${built.clientId}', '${inner.replace(/'/g, "''")}'`
      : inner;

    const after = Number(body?.after) || 0;
    const limit = Math.min(Math.max(Number(body?.limit) || 500, 50), 1000);
    const clientesOnly = body?.clientes_only !== false;

    const sql = `SELECT TOP ${limit} ${COLS}
      FROM pessoa p WITH (NOLOCK)
      WHERE p.cd_pessoa > ${after}${clientesOnly ? ' AND p.fl_cliente_pessoa = 1' : ''}
      ORDER BY p.cd_pessoa`;

    const rows = getRows(await runQuery(source, wrap(sql), 45000)).map((r: any) => ({
      ...r,
      relacionamento: relacionamento(r),
      dt_ani_pessoa: dateOnly(r.dt_ani_pessoa),
      dt_cad_pessoa: dateOnly(r.dt_cad_pessoa),
      dt_ult_atividade: dateOnly(r.dt_ult_atividade),
      obs_pessoa: String(r.obs_pessoa ?? '').trim(),
    }));

    const nextCursor = rows.length === limit ? Number(rows[rows.length - 1].cd_pessoa) : null;

    return Response.json({
      success: true,
      rows,
      count: rows.length,
      next_cursor: nextCursor,
      source_name: source.name,
      query: sql,
    });
  } catch (error: any) {
    return Response.json({ success: false, error: (error.message || String(error)).slice(0, 400) }, { status: 500 });
  }
}