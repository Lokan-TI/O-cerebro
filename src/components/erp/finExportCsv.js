// Geração de CSV (Excel-friendly) para a exportação CAP/CAR.
// Identificadores (CNPJ/CPF, boletos, códigos de barras) saem como texto ="..."
// para o Excel não corromper zeros à esquerda / notação científica.

const TEXT_COLS = new Set([
  "rel_cliente_cnpj", "rel_cliente_cpf", "rel_credor_cnpj", "rel_credor_cpf",
  "nr_codbarras", "cd_barras_api", "nr_boleto", "nr_che_cap", "nr_docto_ori",
]);

function formatCell(colId, value) {
  if (value == null) return "";
  let v = value;
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
    v = v.slice(0, 19).replace("T", " ");
  }
  const s = String(v).replace(/"/g, '""');
  if (TEXT_COLS.has(colId)) return `"=""${s}"""`;
  return `"${s}"`;
}

export function downloadFinCsv({ doc, columns, rows }) {
  const header = columns.map((c) => `"${c.label.replace(/"/g, '""')}"`).join(";");
  const lines = rows.map((row) =>
    columns.map((c) => formatCell(c.id, row[c.id])).join(";")
  );
  const csv = "\uFEFF" + [header, ...lines].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${doc}_export_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}