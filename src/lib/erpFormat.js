export function fmtCur(v) {
  if (v == null || isNaN(v)) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}
export function fmtNum(v) {
  if (v == null || isNaN(v)) return "—";
  return new Intl.NumberFormat("pt-BR").format(v);
}
export function fmtMonthLabel(mes, ano) {
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${months[(mes - 1) % 12]}/${String(ano).slice(2)}`;
}