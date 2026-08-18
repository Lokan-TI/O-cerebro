// Exporta a lista de clientes ativos em CSV compatível com Excel (BOM + ponto e vírgula).
const COLS = [
  ["cd_pessoa", "Código"],
  ["nm_pessoa", "Cliente"],
  ["nm_empresa", "Empresa Sisloc"],
  ["cd_empresa", "Código Empresa"],
  ["receita", "Receita (R$)"],
  ["share", "% da receita"],
  ["nfs", "NFs"],
  ["ultima_nf", "Última NF"],
  ["contratos_ativos", "Contratos ativos"],
  ["contratos_total", "Contratos (histórico)"],
];

const asExcelText = (v) => (v ? `="${v}"` : "");

export function exportClientesAtivosCsv(clients) {
  const esc = (v) => {
    if (typeof v === "number") return String(v).replace(".", ",");
    const s = String(v ?? "");
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = COLS.map(([, label]) => label).join(";");
  const lines = clients.map((r) =>
    COLS.map(([key]) => {
      // Códigos vão como texto para o Excel não remover zeros à esquerda
      if (key === "cd_pessoa" || key === "cd_empresa") return esc(asExcelText(String(r[key] ?? "").trim()));
      if (key === "share") return esc(Number(r.share || 0).toFixed(2));
      if (key === "receita") return esc(Number(r.receita || 0).toFixed(2));
      return esc(r[key]);
    }).join(";")
  );
  const csv = "\uFEFF" + [header, ...lines].join("\r\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "clientes_ativos.csv";
  a.click();
  URL.revokeObjectURL(url);
}