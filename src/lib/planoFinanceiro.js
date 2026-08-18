// Interpretação do plano financeiro do Sisloc (dicionário: plano.nr_planfin, 9 dígitos).
// Níveis: 1 = 1 dígito · 2 = 2 dígitos · 3 = 4 dígitos · 4 = conta analítica (9 dígitos).

export const NIVEL_LEN = [1, 2, 4, 9];

export function levelOf(nr = "") {
  const s = String(nr).padEnd(9, "0");
  if (s.slice(1) === "00000000") return 1;
  if (s.slice(2) === "0000000") return 2;
  if (s.slice(4) === "00000") return 3;
  return 4;
}

export const codeAt = (nr = "", nivel = 4) => String(nr).slice(0, NIVEL_LEN[nivel - 1]);
const fullCode = (code) => String(code).padEnd(9, "0");

export function planIndex(plano = []) {
  const idx = {};
  for (const p of plano) if (p.nr) idx[p.nr] = p.ds;
  return idx;
}

export const labelOf = (idx, code) => idx[fullCode(code)] || `Conta ${code}`;

// Natureza de mercado por grupo de nível 2 do plano.
export function naturezaOf(nr = "", ds = "") {
  const n1 = codeAt(nr, 1);
  const n2 = codeAt(nr, 2);
  if (/transfer/i.test(ds) || n2 === "19" || n2 === "29") return "movimentacao";
  if (n1 === "1") return "entrada";
  if (n2 === "22") return "capex";
  if (n1 === "2") return "opex";
  return "indefinido";
}

export const NATUREZA_LABEL = {
  entrada: "Entrada",
  capex: "CAPEX — investimento",
  opex: "OPEX — custo e despesa",
  movimentacao: "Movimentação entre contas",
  indefinido: "Sem classificação",
};

// Árvore hierárquica de 4 níveis a partir das contas movimentadas.
export function buildTree(rows = [], idx = {}) {
  const roots = {};
  const nodeFor = (map, code, nivel) => {
    if (!map[code]) {
      map[code] = {
        code,
        nivel,
        label: labelOf(idx, code),
        valor: 0,
        direto: 0,
        qtd: 0,
        children: {},
      };
    }
    return map[code];
  };

  for (const r of rows) {
    const nr = String(r.nr || "");
    if (!nr) continue;
    const nivel = levelOf(nr);
    const n1 = nodeFor(roots, codeAt(nr, 1), 1);
    const n2 = nodeFor(n1.children, codeAt(nr, 2), 2);
    const n3 = nodeFor(n2.children, codeAt(nr, 3), 3);
    const chain = [n1, n2, n3];
    for (const n of chain) {
      n.valor += r.valor;
      n.qtd += r.qtd;
    }
    if (nivel === 4) {
      const n4 = nodeFor(n3.children, nr, 4);
      n4.label = r.ds || n4.label;
      n4.valor += r.valor;
      n4.qtd += r.qtd;
    } else {
      // Lançado direto numa conta sintética — não há detalhe analítico no ERP.
      chain[nivel - 1].direto += r.valor;
    }
  }

  const sortNode = (n) => ({
    ...n,
    children: Object.values(n.children).map(sortNode).sort((a, b) => b.valor - a.valor),
  });
  return Object.values(roots).map(sortNode).sort((a, b) => b.valor - a.valor);
}

// Totais por natureza + DRE de caixa.
export function financeSummary(data) {
  const contas = [...(data?.saidas || [])].filter((c) => c.valor !== 0)
    .map((c) => ({ ...c, natureza: naturezaOf(c.nr, c.ds) }));
  const entradas = [...(data?.entradas || [])].filter((c) => c.valor !== 0)
    .map((c) => ({ ...c, natureza: naturezaOf(c.nr, c.ds) }));

  const sum = (arr, f) => arr.filter(f).reduce((s, c) => s + c.valor, 0);

  const receita = sum(entradas, (c) => c.natureza === "entrada");
  const outrasEntradas = sum(entradas, (c) => c.natureza !== "entrada" && c.natureza !== "movimentacao");
  const opex = sum(contas, (c) => c.natureza === "opex");
  const capex = sum(contas, (c) => c.natureza === "capex");
  const saidaEmContaDeEntrada = sum(contas, (c) => c.natureza === "entrada");
  const semClassificacao = sum(contas, (c) => c.natureza === "indefinido");
  const movimentacao = sum(contas, (c) => c.natureza === "movimentacao");
  const sinteticas = contas.filter((c) => c.natureza !== "movimentacao" && levelOf(c.nr) < 4);

  const saidaOperacional = opex + saidaEmContaDeEntrada + semClassificacao;
  return {
    receita,
    outrasEntradas,
    opex,
    capex,
    saidaEmContaDeEntrada,
    semClassificacao,
    movimentacao,
    saidaOperacional,
    saidaTotal: saidaOperacional + capex,
    resultadoOperacional: receita + outrasEntradas - saidaOperacional,
    resultadoAposInvestimento: receita + outrasEntradas - saidaOperacional - capex,
    sinteticas: sinteticas.sort((a, b) => b.valor - a.valor),
    sinteticasTotal: sinteticas.reduce((s, c) => s + c.valor, 0),
    contas,
    entradas,
  };
}

// Ralos: maiores saídas reais (sem transferências), com participação no total.
export function ralos(summary, limite = 15) {
  const alvo = summary.contas.filter((c) => c.natureza !== "movimentacao" && c.valor > 0);
  const total = alvo.reduce((s, c) => s + c.valor, 0);
  return alvo
    .sort((a, b) => b.valor - a.valor)
    .slice(0, limite)
    .map((c) => ({
      ...c,
      share: total ? (c.valor / total) * 100 : 0,
      sintetica: levelOf(c.nr) < 4,
    }));
}