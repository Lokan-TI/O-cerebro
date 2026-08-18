// Constrói a árvore de centros de custo a partir do plano financeiro do Sisloc.
// Grupo (2 dígitos) → Bloco (4 dígitos) → Conta analítica.

const FALLBACK_GRUPO = {
  "20": "SAÍDAS (conta sintética)",
  "21": "DESPESAS OPERACIONAIS",
  "22": "AQUISIÇÕES E INVESTIMENTOS",
  "29": "OUTRAS SAÍDAS",
};

// Visão executiva: como cada bloco entra na leitura Operacional x Administrativo.
export const MACRO_POR_BLOCO = {
  "2000": "nao_classificado",
  "2100": "operacional",
  "2200": "investimento",
  "2900": "outros",
  "2101": "operacional",
  "2102": "operacional",
  "2103": "administrativo",
  "2104": "administrativo",
  "2105": "financeiro",
  "2106": "comercial",
  "2107": "impostos",
  "2108": "outros",
  "2201": "investimento",
  "2202": "investimento",
  "2901": "outros",
};

export const MACRO_LABEL = {
  operacional: "Operacional (pessoal interno e terceirizado)",
  administrativo: "Administrativo (estrutura e diretoria)",
  comercial: "Comercial",
  financeiro: "Financeiro",
  impostos: "Impostos",
  investimento: "Investimentos",
  outros: "Outros",
  nao_classificado: "Sem classificação (lançado na conta sintética)",
};

const FIELDS = ["qtd", "vl_total", "vl_pago", "vl_aberto", "vl_vencido"];
const zero = () => ({ qtd: 0, vl_total: 0, vl_pago: 0, vl_aberto: 0, vl_vencido: 0 });

function label(nos, nr, fallback) {
  const node = nos.find((n) => n.nr_planfin === nr);
  return node?.ds_planfin || fallback;
}

export function buildCustoTree(contas, nos, term = "") {
  const q = term.trim().toLowerCase();
  const grupos = new Map();
  const totals = zero();
  const macro = {};
  const fora = zero(); // títulos de CAP fora das contas de saída (2xx)

  for (const r of contas || []) {
    const nr = String(r.nr_planfin || "");
    if (!nr.startsWith("2")) {
      for (const f of FIELDS) fora[f] += Number(r[f]) || 0;
      continue; // só saídas
    }
    for (const f of FIELDS) totals[f] += Number(r[f]) || 0;

    const grupoKey = nr.slice(0, 2);
    const blocoKey = nr.slice(0, 4);
    const m = MACRO_POR_BLOCO[blocoKey] || "outros";
    if (!macro[m]) macro[m] = zero();
    for (const f of FIELDS) macro[m][f] += Number(r[f]) || 0;

    if (q && !`${r.ds_planfin} ${nr}`.toLowerCase().includes(q)) continue;

    if (!grupos.has(grupoKey)) {
      grupos.set(grupoKey, {
        key: grupoKey,
        label: label(nos || [], `${grupoKey}0000000`, FALLBACK_GRUPO[grupoKey] || "Sem grupo"),
        blocos: new Map(),
        subtotal: zero(),
      });
    }
    const g = grupos.get(grupoKey);
    for (const f of FIELDS) g.subtotal[f] += Number(r[f]) || 0;

    if (!g.blocos.has(blocoKey)) {
      g.blocos.set(blocoKey, {
        key: blocoKey,
        label: label(nos || [], `${blocoKey}00000`, "Sem bloco definido"),
        macro: MACRO_POR_BLOCO[blocoKey] || "outros",
        contas: [],
        subtotal: zero(),
      });
    }
    const b = g.blocos.get(blocoKey);
    b.contas.push(r);
    for (const f of FIELDS) b.subtotal[f] += Number(r[f]) || 0;
  }

  const tree = Array.from(grupos.values())
    .map((g) => ({
      ...g,
      blocos: Array.from(g.blocos.values())
        .map((b) => ({ ...b, contas: b.contas.sort((a, z) => (z.vl_total || 0) - (a.vl_total || 0)) }))
        .sort((a, z) => (z.subtotal.vl_total || 0) - (a.subtotal.vl_total || 0)),
    }))
    .sort((a, z) => (z.subtotal.vl_total || 0) - (a.subtotal.vl_total || 0));

  return { tree, totals, macro, fora };
}

// Série mensal agregada por macro-categoria (Operacional, Administrativo, …).
export function buildMacroMensal(mensal) {
  const map = new Map();
  for (const r of mensal || []) {
    if (!String(r.nr_bloco || "").startsWith("2")) continue; // só saídas
    const key = `${r.ano}-${String(r.mes).padStart(2, "0")}`;
    if (!map.has(key)) {
      map.set(key, { label: `${String(r.mes).padStart(2, "0")}/${String(r.ano).slice(-2)}`, key, operacional: 0, administrativo: 0, comercial: 0, financeiro: 0, impostos: 0, investimento: 0, outros: 0, nao_classificado: 0 });
    }
    const m = MACRO_POR_BLOCO[String(r.nr_bloco || "")] || "outros";
    map.get(key)[m] += Number(r.vl_pago) || 0;
  }
  return Array.from(map.values()).sort((a, z) => a.key.localeCompare(z.key));
}