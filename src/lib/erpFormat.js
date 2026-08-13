export function fmtCur(v) {
  if (v == null || isNaN(v)) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}
export function fmtNum(v) {
  if (v == null || isNaN(v)) return "—";
  return new Intl.NumberFormat("pt-BR").format(v);
}
// Normaliza CPF/CNPJ para somente dígitos (com zeros à esquerda restaurados)
export function onlyDigits(v) {
  return String(v ?? "").replace(/\D/g, "");
}
// Formata documento em máscara padrão: CPF 000.000.000-00 · CNPJ 00.000.000/0000-00
export function fmtDoc(v) {
  const d = onlyDigits(v);
  if (!d) return "";
  if (d.length <= 11) {
    const c = d.padStart(11, "0");
    return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`;
  }
  const c = d.padStart(14, "0").slice(0, 14);
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
}
export function fmtMonthLabel(mes, ano) {
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${months[(mes - 1) % 12]}/${String(ano).slice(2)}`;
}