// CSV do saneamento TOTVS (SE1/SE2). Códigos, lojas, filiais e nº de título saem
// como texto para o Excel não comer zeros à esquerda nem virar notação científica.

const TEXT_COLS = new Set([
  "E1_FILIAL", "E1_CLIENTE", "E1_LOJA", "E1_NUM", "E1_PARCELA", "E1_MOEDA",
  "E2_FILIAL", "E2_FORNECE", "E2_LOJA", "E2_NUM", "E2_PARCELA", "E2_MOEDA",
  "SISLOC_DOCUMENTO",
]);

const MONEY_COLS = new Set(["E1_VALOR", "E1_SALDO", "E2_VALOR", "E2_SALDO"]);

function cell(colId, value) {
  if (value == null) return '""';
  const s = String(value).replace(/"/g, '""');
  if (TEXT_COLS.has(colId)) return `"=""${s}"""`;
  if (MONEY_COLS.has(colId)) return `"${s.replace(".", ",")}"`;
  return `"${s}"`;
}

export function downloadTotvsCsv({ doc, columns, rows }) {
  const header = columns.map((c) => `"${c.id}"`).join(";");
  const lines = rows.map((r) => columns.map((c) => cell(c.id, r[c.id])).join(";"));
  const csv = "\uFEFF" + [header, ...lines].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${doc === "cap" ? "SE2_CONTAS_A_PAGAR" : "SE1_CONTAS_A_RECEBER"}_totvs_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}