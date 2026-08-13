// Phase 3 — Canonical Data Platform · primeira fatia: Party & identity resolution.
// Resolução determinística por documento normalizado (CNPJ/CPF, apenas dígitos),
// conforme docs/09_IDENTITY_RESOLUTION.md. Nenhuma contagem canônica nasce TRUSTED:
// o relatório reconcilia o canônico contra a contagem legada por registro.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { execRead } from '../../shared/erpConnection.ts';

// Documento normalizado: só dígitos relevantes, CNPJ tem prioridade sobre CPF.
const DOC = `REPLACE(REPLACE(REPLACE(REPLACE(ISNULL(NULLIF(LTRIM(RTRIM(nr_cnpj_pessoa)),''), nr_cpf_pessoa),'.',''),'-',''),'/',''),' ','')`;
const VALID_DOC = `LEN(${DOC}) IN (11,14)`;

export default async function (req: Request): Promise<Response> {
  const started = Date.now();
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') {
      return Response.json({ error: 'Apenas administradores podem executar a resolução de identidade.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    let source = null;
    if (body?.source_id) {
      source = await base44.asServiceRole.entities.ErpDataSource.get(body.source_id);
    } else {
      const list = await base44.asServiceRole.entities.ErpDataSource.filter({ credential_reference: 'env' });
      source = list?.[0] || null;
    }
    if (!source) return Response.json({ error: 'Fonte de dados não encontrada.' }, { status: 404 });

    const warnings: string[] = [];
    let queryCount = 0;

    // 1 — Inventário de registros e papéis (PartyRole)
    const roleSql = `SELECT COUNT(*) AS total,
      SUM(CASE WHEN fl_cliente_pessoa = 1 THEN 1 ELSE 0 END) AS clientes,
      SUM(CASE WHEN fl_fornec_pessoa = 1 THEN 1 ELSE 0 END) AS fornecedores,
      SUM(CASE WHEN fl_funcion_pessoa = 1 THEN 1 ELSE 0 END) AS funcionarios,
      SUM(CASE WHEN (CASE WHEN fl_cliente_pessoa = 1 THEN 1 ELSE 0 END + CASE WHEN fl_fornec_pessoa = 1 THEN 1 ELSE 0 END + CASE WHEN fl_funcion_pessoa = 1 THEN 1 ELSE 0 END) > 1 THEN 1 ELSE 0 END) AS multi_papel,
      SUM(CASE WHEN (CASE WHEN fl_cliente_pessoa = 1 THEN 1 ELSE 0 END + CASE WHEN fl_fornec_pessoa = 1 THEN 1 ELSE 0 END + CASE WHEN fl_funcion_pessoa = 1 THEN 1 ELSE 0 END) = 0 THEN 1 ELSE 0 END) AS sem_papel,
      SUM(CASE WHEN ${VALID_DOC} THEN 1 ELSE 0 END) AS doc_valido
      FROM pessoa`;
    const roleRes = await execRead(source, roleSql, 45000);
    queryCount++;
    const r0 = roleRes.recordset?.[0] || {};
    const sourceRecords = Number(r0.total || 0);
    const validDocument = Number(r0.doc_valido || 0);

    // 2 — Identidade canônica: documentos distintos + registros sem documento válido
    const canonSql = `SELECT
      (SELECT COUNT(DISTINCT ${DOC}) FROM pessoa WHERE ${VALID_DOC}) AS docs_distintos,
      (SELECT COUNT(*) FROM pessoa WHERE NOT (${VALID_DOC})) AS sem_doc,
      (SELECT COUNT(DISTINCT ${DOC}) FROM pessoa WHERE ${VALID_DOC} AND fl_cliente_pessoa = 1) AS docs_clientes,
      (SELECT COUNT(*) FROM pessoa WHERE NOT (${VALID_DOC}) AND fl_cliente_pessoa = 1) AS clientes_sem_doc`;
    const canonRes = await execRead(source, canonSql, 60000);
    queryCount++;
    const c0 = canonRes.recordset?.[0] || {};
    const distinctDocs = Number(c0.docs_distintos || 0);
    const withoutDoc = Number(c0.sem_doc || 0);
    const canonicalParties = distinctDocs + withoutDoc;
    const canonicalCustomers = Number(c0.docs_clientes || 0) + Number(c0.clientes_sem_doc || 0);
    const legacyCustomerCount = Number(r0.clientes || 0);

    // 3 — Duplicidades determinísticas
    const dupSql = `SELECT COUNT(*) AS grupos, ISNULL(SUM(qtd), 0) AS registros
      FROM (SELECT ${DOC} AS doc, COUNT(*) AS qtd FROM pessoa WHERE ${VALID_DOC} GROUP BY ${DOC} HAVING COUNT(*) > 1) t`;
    const dupRes = await execRead(source, dupSql, 60000);
    queryCount++;
    const duplicateGroups = Number(dupRes.recordset?.[0]?.grupos || 0);
    const duplicateRecords = Number(dupRes.recordset?.[0]?.registros || 0);

    // 4 — Maiores grupos de duplicidade (fila de revisão)
    let topDuplicates: any[] = [];
    try {
      const topSql = `SELECT TOP 20 ${DOC} AS documento, COUNT(*) AS registros, MIN(nm_pessoa) AS nome_exemplo
        FROM pessoa WHERE ${VALID_DOC} GROUP BY ${DOC} HAVING COUNT(*) > 1 ORDER BY COUNT(*) DESC`;
      const topRes = await execRead(source, topSql, 60000);
      queryCount++;
      topDuplicates = (topRes.recordset || []).map((x: any) => ({
        documento: String(x.documento || ''),
        registros: Number(x.registros || 0),
        nome_exemplo: String(x.nome_exemplo || ''),
      }));
    } catch (e) {
      warnings.push(`Falha ao listar maiores duplicidades: ${e.message}`);
    }

    const invalidDocument = sourceRecords - validDocument;
    const documentCoverage = sourceRecords ? (validDocument / sourceRecords) * 100 : 0;
    const duplicateRate = sourceRecords ? (duplicateRecords / sourceRecords) * 100 : 0;
    const diff = canonicalCustomers - legacyCustomerCount;
    const diffPct = legacyCustomerCount ? (diff / legacyCustomerCount) * 100 : 0;

    if (invalidDocument > 0) {
      warnings.push(`${invalidDocument} registros sem CNPJ/CPF válido permanecem como Party isolado (proibido merge probabilístico automático).`);
    }
    if (duplicateGroups > 0) {
      warnings.push(`${duplicateGroups} documentos aparecem em mais de um registro: a contagem legada por registro superestima clientes.`);
    }

    const version = `PRR-${new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)}`;
    const previous = await base44.asServiceRole.entities.PartyResolutionReport.filter({ source_id: source.id, is_current: true });
    for (const p of previous || []) {
      await base44.asServiceRole.entities.PartyResolutionReport.update(p.id, { is_current: false });
    }

    const report = await base44.asServiceRole.entities.PartyResolutionReport.create({
      source_id: source.id,
      source_name: source.name,
      source_slug: source.branch_code || source.name,
      version,
      is_current: true,
      created_at: new Date().toISOString(),
      generated_by_name: user.full_name || user.email,
      match_method: 'deterministic_document',
      source_records: sourceRecords,
      role_customer: legacyCustomerCount,
      role_supplier: Number(r0.fornecedores || 0),
      role_employee: Number(r0.funcionarios || 0),
      role_multiple: Number(r0.multi_papel || 0),
      role_none: Number(r0.sem_papel || 0),
      valid_document: validDocument,
      invalid_document: invalidDocument,
      document_coverage: Math.round(documentCoverage * 10) / 10,
      duplicate_groups: duplicateGroups,
      duplicate_records: duplicateRecords,
      duplicate_rate: Math.round(duplicateRate * 100) / 100,
      canonical_parties: canonicalParties,
      canonical_customers: canonicalCustomers,
      legacy_customer_count: legacyCustomerCount,
      reconciliation_diff: diff,
      reconciliation_diff_pct: Math.round(diffPct * 100) / 100,
      top_duplicates: topDuplicates,
      warnings,
      query_count: queryCount,
      duration_ms: Date.now() - started,
    });

    return Response.json({ report });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}