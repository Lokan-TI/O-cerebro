export const MESES_ABBR = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// Deriva ano/mês a partir do rótulo "Abr/26" quando a série não traz os campos numéricos
export function parseMonthLabel(row) {
  const ano = Number(row?.ano);
  const mes = Number(row?.mes);
  if (ano && mes) return { ano, mes };
  const [m, y] = String(row?.label || "").split("/").map((s) => s.trim());
  const idx = MESES_ABBR.findIndex((x) => x.toLowerCase() === String(m).slice(0, 3).toLowerCase());
  const yy = Number(y);
  return {
    ano: ano || (yy ? (yy < 100 ? 2000 + yy : yy) : null),
    mes: mes || (idx >= 0 ? idx + 1 : null),
  };
}

// Ordena cronologicamente uma série mensal
export function sortMonthly(rows = []) {
  return [...rows].sort((a, b) => {
    const A = parseMonthLabel(a);
    const B = parseMonthLabel(b);
    return (A.ano - B.ano) || (A.mes - B.mes);
  });
}