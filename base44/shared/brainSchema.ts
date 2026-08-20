// Dicionário de dados do Cérebro — índice de TODAS as tabelas conectadas + colunas sob demanda.

// Tabelas sempre presentes no dicionário enviado ao LLM.
export const KEY_TABLES = ['nf', 'pessoa', 'car', 'cap', 'fich_loc', 'mkt_orcamento', 'patrimon'];

export const FALLBACK_SCHEMA = `nf (notas fiscais): cd_empresa, cd_pessoa, dt_emissao, vl_faturamento
pessoa (clientes): cd_pessoa, nm_pessoa, dt_cad_pessoa, fl_cliente_pessoa
fich_loc (contratos de locação): cd_pessoa, dt_pedido
mkt_orcamento (orçamentos): cd_pessoa_cli, dt_orcamento`;

export type TableIndexRow = { table_name: string; domain?: string };

// Índice barato: uma linha por tabela (primeira coluna do dicionário).
export async function loadTableIndex(base44: any): Promise<TableIndexRow[]> {
  try {
    const rows = await base44.asServiceRole.entities.MetadataCatalog.filter(
      { ordinal_position: 1 },
      'table_name',
      2000,
    );
    return (rows || []).map((r: any) => ({ table_name: r.table_name, domain: r.domain }));
  } catch {
    return [];
  }
}

export function renderTableIndex(index: TableIndexRow[], limit = 700): string {
  return index
    .slice(0, limit)
    .map((t) => (t.domain && t.domain !== 'OTHER' ? `${t.table_name} [${t.domain}]` : t.table_name))
    .join(', ');
}

// Colunas das tabelas escolhidas (dicionário detalhado).
export async function loadColumnsFor(base44: any, tables: string[]): Promise<string> {
  const unique = Array.from(new Set([...KEY_TABLES, ...tables.filter(Boolean)])).slice(0, 14);
  const lists = await Promise.all(
    unique.map((t) =>
      base44.asServiceRole.entities.MetadataCatalog.filter({ table_name: t }, 'ordinal_position', 400)
        .catch(() => []),
    ),
  );
  let brief = '';
  lists.forEach((rows: any[], i: number) => {
    if (!rows || rows.length === 0) return;
    const cols = rows
      .slice(0, 80)
      .map((r) => (r.caption ? `${r.column_name} [${r.data_type}] (${String(r.caption).slice(0, 55)})` : `${r.column_name} [${r.data_type}]`));
    const line = `${unique[i]}: ${cols.join(', ')}\n`;
    if (brief.length + line.length <= 22000) brief += line;
  });
  return brief || FALLBACK_SCHEMA;
}