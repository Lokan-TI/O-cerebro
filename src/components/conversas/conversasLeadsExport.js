// Exportação dos leads do RD Conversas em CSV compatível com Excel (separador ";").
const COLS = [
  ["stage_label", "Estágio do lead"],
  ["nome", "Nome"],
  ["telefone", "Telefone"],
  ["canal", "Canal"],
  ["atendimentos", "Atendimentos"],
  ["total_receive_messages", "Mensagens recebidas"],
  ["total_send_messages", "Mensagens enviadas"],
  ["tabulations", "Tabulações"],
  ["departamentos", "Departamentos"],
  ["atendentes", "Atendentes"],
  ["iniciado_pelo_lead", "Iniciado pelo lead"],
  ["first_contact_at", "Primeiro contato"],
  ["last_contact_at", "Último contato"],
  ["dias_sem_contato", "Dias sem contato"],
];

function cell(value) {
  if (value == null) return "";
  if (Array.isArray(value)) return value.join(" | ");
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  return String(value);
}

function fmtDate(v) {
  if (!v) return "";
  const d = new Date(v);
  return isNaN(d) ? "" : d.toLocaleString("pt-BR");
}

export function exportConversasLeadsCsv(rows, filename = "rd-conversas-leads.csv") {
  const header = COLS.map(([, label]) => label).join(";");
  const lines = rows.map((r) =>
    COLS.map(([key]) => {
      let v = r[key];
      if (key === "first_contact_at" || key === "last_contact_at") v = fmtDate(v);
      if (key === "telefone" && v) v = `="${v}"`;
      const s = cell(v).replace(/"/g, '""').replace(/[\r\n]+/g, " ");
      return s.includes(";") || s.includes('"') ? `"${s}"` : s;
    }).join(";")
  );
  const csv = "\uFEFF" + [header, ...lines].join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}