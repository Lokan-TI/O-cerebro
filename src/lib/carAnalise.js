// Agregações client-side da análise de CAR (linhas por empresa × ano × mês).
const MES = ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const KEYS = ["qtd", "vl_total", "vl_liquidado", "vl_a_vencer", "vl_vencido", "vl_provisorio", "vl_juros_multa"];

const empty = () => Object.fromEntries(KEYS.map((k) => [k, 0]));
const add = (acc, r) => { KEYS.forEach((k) => { acc[k] += Number(r[k]) || 0; }); return acc; };
export const inadPct = (r) => (r.vl_total > 0 ? (r.vl_vencido / r.vl_total) * 100 : 0);

export function sumRows(rows) {
  const t = rows.reduce(add, empty());
  return { ...t, inad: inadPct(t) };
}

// Série mensal com acumulado dentro de cada ano (zera na virada).
export function monthlySeries(rows) {
  const map = new Map();
  for (const r of rows) {
    const k = r.ano * 100 + r.mes;
    if (!map.has(k)) map.set(k, { ...empty(), ano: r.ano, mes: r.mes });
    add(map.get(k), r);
  }
  let ano = null; let acc = 0; let accVen = 0;
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([, r]) => {
    if (r.ano !== ano) { ano = r.ano; acc = 0; accVen = 0; }
    acc += r.vl_total; accVen += r.vl_vencido;
    return { ...r, label: `${MES[r.mes]}/${String(r.ano).slice(2)}`, acumulado: acc, inad: inadPct(r), inad_acum: acc > 0 ? (accVen / acc) * 100 : 0 };
  });
}

// Série anual com acumulado histórico.
export function yearlySeries(rows) {
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.ano)) map.set(r.ano, { ...empty(), ano: r.ano });
    add(map.get(r.ano), r);
  }
  let acc = 0;
  return [...map.values()].sort((a, b) => a.ano - b.ano).map((r) => {
    acc += r.vl_total;
    return { ...r, label: String(r.ano), acumulado: acc, inad: inadPct(r) };
  });
}

export function byEmpresa(rows) {
  const map = new Map();
  for (const r of rows) {
    const k = r.cd_empresa ?? "null";
    if (!map.has(k)) map.set(k, { ...empty(), cd_empresa: r.cd_empresa });
    add(map.get(k), r);
  }
  return [...map.values()].map((r) => ({ ...r, inad: inadPct(r) })).sort((a, b) => b.vl_total - a.vl_total);
}

export const anosDisponiveis = (rows) => [...new Set(rows.map((r) => r.ano))].sort((a, b) => b - a);