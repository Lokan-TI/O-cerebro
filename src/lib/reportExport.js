// Geração de relatórios a partir das linhas retornadas pelo Cérebro.
const fmt = (v) => (v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v));

const download = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const columnsOf = (rows) => Object.keys(rows[0] || {});

const toCsv = (rows, sep = ";") => {
  const cols = columnsOf(rows);
  const esc = (v) => `"${fmt(v).replace(/"/g, '""')}"`;
  return [cols.map(esc).join(sep), ...rows.map((r) => cols.map((c) => esc(r[c])).join(sep))].join("\r\n");
};

const toHtmlTable = (rows, title) => {
  const cols = columnsOf(rows);
  return `<html><head><meta charset="utf-8"></head><body><h3>${title}</h3><table border="1"><thead><tr>${cols
    .map((c) => `<th>${c}</th>`)
    .join("")}</tr></thead><tbody>${rows
    .map((r) => `<tr>${cols.map((c) => `<td>${fmt(r[c])}</td>`).join("")}</tr>`)
    .join("")}</tbody></table></body></html>`;
};

const toMarkdown = (rows) => {
  const cols = columnsOf(rows);
  return [
    `| ${cols.join(" | ")} |`,
    `| ${cols.map(() => "---").join(" | ")} |`,
    ...rows.map((r) => `| ${cols.map((c) => fmt(r[c])).join(" | ")} |`),
  ].join("\n");
};

async function toPdf(rows, title, answer, filename) {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const cols = columnsOf(rows);
  doc.setFontSize(13);
  doc.text(title, 32, 36);
  let y = 56;
  if (answer) {
    doc.setFontSize(9);
    doc.text(doc.splitTextToSize(answer.replace(/[*#`]/g, ""), 760), 32, y);
    y += doc.splitTextToSize(answer.replace(/[*#`]/g, ""), 760).length * 11 + 10;
  }
  doc.setFontSize(8);
  const colW = 760 / Math.max(cols.length, 1);
  const line = (vals, bold) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    vals.forEach((v, i) => doc.text(doc.splitTextToSize(fmt(v), colW - 6)[0] || "", 32 + i * colW, y));
    y += 12;
    if (y > 560) { doc.addPage(); y = 40; }
  };
  line(cols, true);
  rows.forEach((r) => line(cols.map((c) => r[c])));
  doc.save(filename);
}

export const REPORT_FORMATS = [
  { id: "xlsx", label: "Excel" },
  { id: "csv", label: "CSV" },
  { id: "pdf", label: "PDF" },
  { id: "json", label: "JSON" },
  { id: "md", label: "Markdown" },
  { id: "txt", label: "TXT" },
];

export async function exportReport({ format, rows, question, answer }) {
  if (!rows?.length) return;
  const stamp = new Date().toISOString().slice(0, 10);
  const base = `cerebro-relatorio-${stamp}`;
  const title = question || "Relatório do Cérebro";

  if (format === "csv") return download(new Blob(["\uFEFF" + toCsv(rows)], { type: "text/csv;charset=utf-8" }), `${base}.csv`);
  if (format === "xlsx") return download(new Blob([toHtmlTable(rows, title)], { type: "application/vnd.ms-excel" }), `${base}.xls`);
  if (format === "json") return download(new Blob([JSON.stringify({ pergunta: question, resposta: answer, dados: rows }, null, 2)], { type: "application/json" }), `${base}.json`);
  if (format === "md") return download(new Blob([`# ${title}\n\n${answer || ""}\n\n${toMarkdown(rows)}\n`], { type: "text/markdown" }), `${base}.md`);
  if (format === "txt") return download(new Blob([`${title}\n\n${answer || ""}\n\n${toCsv(rows, "\t")}\n`], { type: "text/plain;charset=utf-8" }), `${base}.txt`);
  if (format === "pdf") return toPdf(rows, title, answer, `${base}.pdf`);
}