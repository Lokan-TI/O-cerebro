import { onlyDigits } from "@/lib/erpFormat";

export const STATUS = {
  igual: { label: "Confere", cls: "text-emerald-400" },
  corrigido: { label: "Corrigido", cls: "text-purple-300" },
  preenchido: { label: "Preenchido", cls: "text-sky-300" },
  sem_email: { label: "Sem e-mail na fonte", cls: "text-gray-400" },
  nao_encontrado: { label: "CNPJ não encontrado", cls: "text-amber-400" },
  cnpj_invalido: { label: "CNPJ inválido", cls: "text-red-400" },
  erro: { label: "Erro na consulta", cls: "text-red-400" },
  pendente: { label: "Pendente", cls: "text-gray-600" },
};

export function validCnpj(v) {
  const c = onlyDigits(v || "");
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const dv = (len) => {
    let sum = 0, pos = len - 7;
    for (let i = 0; i < len; i++) { sum += Number(c[i]) * pos--; if (pos < 2) pos = 9; }
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dv(12) === Number(c[12]) && dv(13) === Number(c[13]);
}

export function classify(row, res) {
  if (!res) return "pendente";
  if (res.status === "not_found") return "nao_encontrado";
  if (res.status !== "ok") return "erro";
  const atual = (row.email || "").trim().toLowerCase();
  if (!res.email) return "sem_email";
  if (!atual) return "preenchido";
  return atual.split(/[;,\s]+/).includes(res.email) ? "igual" : "corrigido";
}

const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
export function downloadCsv(name, header, lines) {
  const csv = "\uFEFF" + [header, ...lines].map((l) => l.map(csvCell).join(";")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = name;
  a.click();
}