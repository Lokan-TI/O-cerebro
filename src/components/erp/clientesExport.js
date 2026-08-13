// Exporta a base de clientes em CSV compatível com Excel (BOM + ponto e vírgula).
// Inclui TODAS as colunas presentes nos registros — as conhecidas com rótulo amigável
// e, na sequência, quaisquer campos extras que vierem do snapshot.
import { fmtDoc } from "@/lib/erpFormat";

const LABELS = {
  global_id: "ID global",
  cd_pessoa: "Código",
  nm_pessoa: "Cliente",
  documento: "CNPJ/CPF",
  cd_empresa: "Código Empresa",
  empresa_nome: "Empresa",
  status: "Status",
  qtd_fichas: "Fichas de locação",
  qtd_nf: "Notas fiscais",
  faturamento: "Faturamento (R$)",
  ticket_medio: "Ticket médio (R$)",
  car_aberto: "CAR em aberto (R$)",
  primeira_atividade: "Primeira atividade",
  ultima_atividade: "Última atividade",
};

const asExcelText = (v) => (v ? `="${v}"` : "");

function buildColumns(clients) {
  const known = Object.keys(LABELS).filter((k) => clients.some((c) => k in c));
  const extras = [...new Set(clients.flatMap((c) => Object.keys(c)))].filter((k) => !(k in LABELS));
  return [...known, ...extras];
}

export function exportClientesCsv(clients) {
  if (!clients?.length) return;
  const cols = buildColumns(clients);

  const esc = (v) => {
    if (v === true) return "Sim";
    if (v === false) return "Não";
    if (v === null || v === undefined) return "";
    if (typeof v === "number") return String(v).replace(".", ",");
    if (typeof v === "object") return JSON.stringify(v);
    const s = String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const header = cols.map((k) => LABELS[k] || k).join(";");
  const lines = clients.map((c) =>
    cols
      .map((k) => {
        if (k === "documento") return esc(asExcelText(fmtDoc(c[k])));
        if (k === "global_id" || k === "cd_pessoa") return esc(asExcelText(String(c[k] ?? "").trim()));
        return esc(c[k]);
      })
      .join(";")
  );
  const csv = "\uFEFF" + [header, ...lines].join("\r\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "clientes_base_completa.csv";
  a.click();
  URL.revokeObjectURL(url);
}