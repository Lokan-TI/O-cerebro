// Dicionário de dados do Cérebro — índice de TODAS as tabelas conectadas + colunas sob demanda.

// Tabelas sempre presentes no dicionário enviado ao LLM.
export const KEY_TABLES = [
  'nf', 'pessoa', 'car', 'cap', 'fich_loc', 'mkt_orcamento', 'patrimon',
  'fl_fatura', 'nffatur', 'grupo', 'equipto',
];

export const FALLBACK_SCHEMA = `REGRAS FÍSICAS SISLOC — não inventar aliases nem substituir campos entre objetos.
nf (notas fiscais): cd_nf, cd_empresa, cd_pessoa, cd_pessoa_fun, dt_emi_nf, vl_faturamento, fl_ent_sai, fl_can_nf, dt_cancelamento, dt_anul_nf
pessoa (cadastro de pessoas): cd_pessoa, nm_pessoa, nm_fan_pessoa, dt_cad_pessoa, fl_cliente_pessoa
fich_loc (ficha de locação): cd_controle, cd_pessoa, cd_empresa, dt_pedido, dt_enc_ficha
fl_fatura (fatura de locação): cd_flfatura, cd_controle, cd_nf, dt_geracao, vl_fatura
nffatur (faturamento/parcelamento da NF): cd_nf, dt_ven_nffatur, vl_bruto, vl_nffatur
grupo: cd_grupo, nm_grupo
equipto: cd_equipto, nm_equipto, cd_grupo, cd_equfamilia
mkt_orcamento (orçamento comercial): cd_controle, cd_empresa, cd_pessoa_cli, cd_pessoa_fun, dt_orcamento, dt_emissao, dt_aprovacao, dt_cancelamento
OBSERVADO EM LOG ERP: v_nf_emissao é uma VIEW distinta; Receita por Grupo usa v_nf_emissao.cd_nf = nf.cd_nf e v_nf_emissao.dt_emissao. Não usar nf.dt_emissao — na tabela nf o campo físico confirmado é dt_emi_nf.`;

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