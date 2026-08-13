import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { execRead } from '../../shared/erpConnection.ts';

const CORE_TABLES = ['nf', 'cliente', 'financas_car', 'financas_car_comissao', 'financas_cap', 'est_mov', 'est_movitem', 'fl_remessa', 'mkt_orcamento'];

const PII_PATTERNS = [
  { like: '%cpf%', category: 'documento' },
  { like: '%cnpj%', category: 'documento' },
  { like: '%rg%', category: 'documento' },
  { like: '%email%', category: 'contato' },
  { like: '%fone%', category: 'contato' },
  { like: '%celular%', category: 'contato' },
  { like: '%endereco%', category: 'endereco' },
  { like: '%logradouro%', category: 'endereco' },
  { like: '%nascimento%', category: 'pessoal' },
];

export default async function (req: Request): Promise<Response> {
  const started = Date.now();
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Apenas administradores podem executar a descoberta de fontes.' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const sourceId = body?.source_id;
    let source = null;
    if (sourceId) {
      source = await base44.asServiceRole.entities.ErpDataSource.get(sourceId);
    } else {
      const list = await base44.asServiceRole.entities.ErpDataSource.filter({ credential_reference: 'env' });
      source = list?.[0] || null;
    }
    if (!source) return Response.json({ error: 'Fonte de dados não encontrada.' }, { status: 404 });

    const warnings: string[] = [];
    let queryCount = 0;
    let dictionaryAvailable = true;

    // 1 — Tabelas catalogadas (linhas de tabela: Coluna vazia)
    let tableCount = 0;
    try {
      const r = await execRead(source, "SELECT COUNT(*) AS total FROM v_Dicionario_Dados WHERE Coluna = ''", 30000);
      queryCount++;
      tableCount = Number(r.recordset?.[0]?.total || 0);
    } catch (e) {
      dictionaryAvailable = false;
      warnings.push(`Dicionário indisponível: ${e.message}`);
    }

    let columnCount = 0, documentedColumns = 0, fkDeclared = 0;
    if (dictionaryAvailable) {
      // 2 — Cobertura de documentação e chaves estrangeiras
      const r = await execRead(
        source,
        "SELECT COUNT(*) AS total, SUM(CASE WHEN LTRIM(RTRIM(Caption)) <> '' THEN 1 ELSE 0 END) AS documentadas, SUM(CASE WHEN LTRIM(RTRIM(Chave_estrangeira)) <> '' THEN 1 ELSE 0 END) AS fks FROM v_Dicionario_Dados WHERE Coluna <> ''",
        45000
      );
      queryCount++;
      const row = r.recordset?.[0] || {};
      columnCount = Number(row.total || 0);
      documentedColumns = Number(row.documentadas || 0);
      fkDeclared = Number(row.fks || 0);
    }

    // 3 — Colunas com dado pessoal (serial, um padrão por vez)
    const piiColumns: any[] = [];
    if (dictionaryAvailable) {
      for (const p of PII_PATTERNS) {
        try {
          const r = await execRead(
            source,
            `SELECT TOP 40 Tabela, Coluna, Caption FROM v_Dicionario_Dados WHERE Coluna LIKE '${p.like}' ORDER BY Tabela, Coluna`,
            30000
          );
          queryCount++;
          for (const row of r.recordset || []) {
            piiColumns.push({ tabela: row.Tabela, coluna: row.Coluna, caption: row.Caption, categoria: p.category });
          }
        } catch (e) {
          warnings.push(`Falha ao classificar PII (${p.like}): ${e.message}`);
        }
      }
    }

    // 4 — Presença das tabelas críticas de negócio
    const coreTables: any[] = [];
    if (dictionaryAvailable) {
      const inList = CORE_TABLES.map((t) => `'${t}'`).join(',');
      const r = await execRead(
        source,
        `SELECT Tabela, COUNT(*) AS colunas FROM v_Dicionario_Dados WHERE Tabela IN (${inList}) AND Coluna <> '' GROUP BY Tabela`,
        45000
      );
      queryCount++;
      const found = new Map((r.recordset || []).map((x: any) => [x.Tabela, Number(x.colunas || 0)]));
      for (const t of CORE_TABLES) {
        const present = found.has(t);
        coreTables.push({ tabela: t, presente: present, colunas: found.get(t) || 0 });
        if (!present) warnings.push(`Tabela crítica ausente no dicionário: ${t}`);
      }
    }

    // 5 — Trust Score
    const docCoverage = columnCount ? (documentedColumns / columnCount) * 100 : 0;
    const corePresence = coreTables.length ? (coreTables.filter((c) => c.presente).length / coreTables.length) * 100 : 0;
    const fkCoverage = columnCount ? Math.min(100, (fkDeclared / columnCount) * 100 * 4) : 0;
    const breakdown = {
      dicionario: { peso: 20, nota: dictionaryAvailable ? 100 : 0 },
      documentacao: { peso: 30, nota: Math.round(docCoverage) },
      tabelas_criticas: { peso: 35, nota: Math.round(corePresence) },
      relacionamentos: { peso: 15, nota: Math.round(fkCoverage) },
    };
    const trustScore = Math.round(
      Object.values(breakdown).reduce((acc: number, b: any) => acc + (b.peso * b.nota) / 100, 0)
    );

    const version = `SOR-${new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)}`;
    const previous = await base44.asServiceRole.entities.SourceOnboardingReport.filter({ source_id: source.id, is_current: true });
    for (const p of previous || []) {
      await base44.asServiceRole.entities.SourceOnboardingReport.update(p.id, { is_current: false });
    }

    const report = await base44.asServiceRole.entities.SourceOnboardingReport.create({
      source_id: source.id,
      source_name: source.name,
      version,
      is_current: true,
      created_at: new Date().toISOString(),
      generated_by_name: user.full_name || user.email,
      dictionary_available: dictionaryAvailable,
      table_count: tableCount,
      column_count: columnCount,
      documented_columns: documentedColumns,
      documentation_coverage: Math.round(docCoverage * 10) / 10,
      fk_declared: fkDeclared,
      pii_columns: piiColumns,
      pii_count: piiColumns.length,
      core_tables: coreTables,
      trust_score: trustScore,
      trust_breakdown: breakdown,
      warnings,
      duration_ms: Date.now() - started,
      query_count: queryCount,
    });

    return Response.json({ report });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}