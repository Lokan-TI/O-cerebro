import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { buildConfig, runQuery } from '../../shared/erpConnection.ts';
import { lookupBatch, validCnpj } from '../../shared/openCnpj.ts';

// Correção cadastral por CNPJ. Somente leitura na tabela PESSOA do ERP.
// action 'load': lê clientes/fornecedores com CNPJ (formato colunar).
// action 'lookup': consulta até 25 CNPJs na base pública.
const COLS = ['cd_pessoa', 'nm_pessoa', 'nm_fan_pessoa', 'nr_cnpj_pessoa', 'log_pessoa', 'num_pessoa', 'comple_pessoa',
  'bairro_pessoa', 'cidade_pessoa', 'uf_pessoa', 'cep_pessoa', 'tel_pessoa', 'en_mail_pessoa', 'fl_ativo', 'fl_cliente_pessoa', 'fl_fornec_pessoa'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Apenas administradores.' }, { status: 403 });
    const body = await req.json().catch(() => ({}));

    if (body.action === 'lookup') {
      const cnpjs = (body.cnpjs || []).map((c: any) => String(c).replace(/\D/g, '')).filter(validCnpj).slice(0, 25);
      return Response.json({ results: await lookupBatch(cnpjs), consulted_at: new Date().toISOString() });
    }

    const tipos: string[] = (body.tipos || []).filter((t: string) => t === 'cliente' || t === 'fornecedor');
    if (!tipos.length) return Response.json({ error: 'Selecione ao menos um tipo de pessoa.' }, { status: 400 });
    let source: any = { credential_reference: 'env' };
    if (body.source_id) {
      source = await base44.asServiceRole.entities.ErpDataSource.get(body.source_id);
      if (!source || source.is_active === false) return Response.json({ error: 'Fonte indisponível.' }, { status: 404 });
    }
    const built = buildConfig(source);
    if (!built) return Response.json({ error: 'Configuração de conexão incompleta.' }, { status: 500 });
    const flags = tipos.map((t) => t === 'cliente' ? 'fl_cliente_pessoa = 1' : 'fl_fornec_pessoa = 1').join(' OR ');
    const sql = `SELECT ${COLS.join(', ')} FROM pessoa WITH (NOLOCK)
      WHERE (${flags}) AND nr_cnpj_pessoa IS NOT NULL AND LTRIM(RTRIM(nr_cnpj_pessoa)) <> ''
      ORDER BY nm_pessoa`;
    const q = built.clientId ? `EXEC DW_API '${built.clientId}', '${sql.replace(/'/g, "''")}'` : sql;
    const rows = (await runQuery(source, q, 45000))?.recordset || [];
    const data = rows.map((r: any) => COLS.map((c) => {
      const v = r[c];
      if (c.startsWith('fl_')) return v === true || v === 1 ? 1 : 0;
      return v == null ? '' : String(v).trim();
    }));
    return Response.json({ cols: COLS, rows: data, sql });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});