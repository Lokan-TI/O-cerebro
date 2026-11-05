// Curvas de recuperação e inadimplência do CAR (linhas por empresa × mês de vencimento).
const MES = ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const KEYS = ["devido", "qtd_aberto", "r0", "r30", "r60", "r90", "r180", "r365", "rmais", "a30", "a60", "a90", "a180", "a365", "amais"];
export const REC_STEPS = [
  ["r0", "No venc."], ["r30", "30 d"], ["r60", "60 d"], ["r90", "90 d"], ["r180", "180 d"], ["r365", "1 ano"], ["rmais", "+1 ano"],
];
export const AGING = [["a30", "1–30 d"], ["a60", "31–60 d"], ["a90", "61–90 d"], ["a180", "91–180 d"], ["a365", "181–365 d"], ["amais", "+1 ano"]];

const empty = () => Object.fromEntries(KEYS.map((k) => [k, 0]));
const add = (acc, r) => { KEYS.forEach((k) => { acc[k] += Number(r[k]) || 0; }); return acc; };
const aberto = (r) => AGING.reduce((s, [k]) => s + r[k], 0);

export const sumCurvas = (rows) => {
  const t = rows.reduce(add, empty());
  return { ...t, aberto: aberto(t) };
};

// Curva de recuperação: % acumulado recuperado do valor devido até cada faixa de dias após o vencimento.
// Uma linha por ano de vencimento (últimos 5) + total.
export function recoveryCurve(rows) {
  const byYear = new Map();
  for (const r of rows) {
    if (!byYear.has(r.ano)) byYear.set(r.ano, empty());
    add(byYear.get(r.ano), r);
  }
  const years = [...byYear.keys()].sort((a, b) => a - b).slice(-5);
  const total = sumCurvas(rows);
  const series = [["Total", total], ...years.map((y) => [String(y), byYear.get(y)])];
  const acc = Object.fromEntries(series.map(([n]) => [n, 0]));
  const data = REC_STEPS.map(([k, label]) => {
    const point = { label };
    for (const [name, t] of series) {
      acc[name] += t[k];
      point[name] = t.devido > 0 ? (acc[name] / t.devido) * 100 : null;
    }
    return point;
  });
  return { data, lines: series.map(([n]) => n) };
}

// Curva de inadimplência: por mês de vencimento, % do valor devido que segue vencido em aberto.
export function delinquencyCurve(rows) {
  const map = new Map();
  for (const r of rows) {
    const k = r.ano * 100 + r.mes;
    if (!map.has(k)) map.set(k, { ...empty(), ano: r.ano, mes: r.mes });
    add(map.get(k), r);
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([, r]) => {
    const ab = aberto(r);
    return { label: `${MES[r.mes]}/${String(r.ano).slice(2)}`, devido: r.devido, aberto: ab, recuperado: r.devido - ab, inad: r.devido > 0 ? (ab / r.devido) * 100 : 0 };
  });
}