import { base44 } from "@/api/base44Client";

export const invokeArchive = async (payload) => {
  const res = await base44.functions.invoke("sislocArchive", payload);
  if (res.data?.error) throw new Error(res.data.error);
  return res.data;
};

export async function loadTables(runId) {
  let cursor, items = [];
  do {
    const page = await base44.entities.SislocArchiveTable.filter({ run_id: runId }, { sort: "table_name", limit: 500, cursor, fields: ["table_name", "status", "source_row_count", "migrated_row_count", "validated_source_count", "last_error", "stable_order", "columns", "primary_key", "foreign_keys"] });
    items = items.concat(page.items);
    cursor = page.next_cursor;
    if (!page.has_more) break;
  } while (cursor);
  return items;
}

export const STATUS_LABEL = {
  pending: "Pendente", extracting: "Extraindo", done: "Carregada", error: "Erro",
  validated: "Validada", divergent: "Divergente",
  inventoried: "Inventariado", migrating: "Migrando", migrated: "Migrado",
  ready_for_shutdown: "Pronto para desligamento", failed: "Falhou",
};