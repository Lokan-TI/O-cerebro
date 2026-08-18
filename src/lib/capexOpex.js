// Classificação de CAPEX x OPEX e cálculo de custo de posse por família de ativo.

// Blocos oficiais do plano financeiro (4 primeiros dígitos de 9).
const BLOCOS = {
  "2201": { categoria: "CAPEX — investimento intelectual", natureza: "capex", corte: "estrategico" },
  "2202": { categoria: "CAPEX — patrimônio material (frota e estruturas)", natureza: "capex", corte: "estrategico" },
  "2101": { categoria: "OPEX — pessoal interno", natureza: "opex", corte: "estrutural" },
  "2102": { categoria: "OPEX — pessoal terceirizado", natureza: "opex", corte: "estrategico" },
  "2103": { categoria: "OPEX — diretoria", natureza: "opex", corte: "estrutural" },
  "2104": { categoria: "OPEX — despesas administrativas", natureza: "opex", corte: "alto" },
  "2105": { categoria: "OPEX — despesas financeiras", natureza: "opex", corte: "estrategico" },
  "2106": { categoria: "OPEX — despesas comerciais", natureza: "opex", corte: "alto" },
  "2107": { categoria: "OPEX — impostos", natureza: "opex", corte: "contratual" },
  "2108": { categoria: "OPEX — outras despesas", natureza: "opex", corte: "alto" },
  "2901": { categoria: "Movimentação entre contas (não é custo)", natureza: "movimentacao", corte: "neutro" },
  "1901": { categoria: "Movimentação entre contas (não é custo)", natureza: "movimentacao", corte: "neutro" },
};

const CAT_RULES = [
  { cat: "CAPEX — ativos de locação", nature: "capex", cut: "estrategico", re: /(imobiliz|aquisi|equipament|maquin|máquin|plataforma|andaime|multidirecion|escorament|frota|patrim|veicul|veícul|caminh)/i },
  { cat: "Financiamento de ativos", nature: "capex", cut: "contratual", re: /(financiam|leasing|consorc|consórc|finame|juros de financ)/i },
  { cat: "Pessoal e encargos", nature: "opex", cut: "estrutural", re: /(salari|salári|folha|encargo|fgts|inss|ferias|férias|13|rescis|vale.?transp|vale.?refei|benefic|benefíc|plano de saude|plano de saúde|pro.?labore|pró.?labore)/i },
  { cat: "Manutenção e peças", nature: "opex", cut: "estrategico", re: /(manuten|peca|peça|reposi|oficina|pneu|lubrific|óleo|oleo|reparo)/i },
  { cat: "Logística e frete", nature: "opex", cut: "estrategico", re: /(frete|transport|combust|pedagio|pedágio|entrega|logist|logíst)/i },
  { cat: "Ocupação e utilidades", nature: "opex", cut: "estrutural", re: /(aluguel|locacao de imovel|locação de imóvel|condomin|condomín|energia|agua|água|telefon|internet|iptu|seguran|limpeza)/i },
  { cat: "Comercial e marketing", nature: "opex", cut: "alto", re: /(marketing|publicid|propagand|comissa|comissã|brinde|feira|evento|patrocin|viagem|represent)/i },
  { cat: "Administrativo e serviços", nature: "opex", cut: "alto", re: /(consultor|assessor|advocat|juridic|jurídic|contabil|contábil|software|licenc|sistema|treinament|material de escrit|copa|cartorio|cartório|correio|despesa diversa|outras despesas)/i },
  { cat: "Tributos", nature: "opex", cut: "contratual", re: /(imposto|tribut|icms|iss|pis|cofins|irpj|csll|simples|darf|gps|taxa)/i },
  { cat: "Financeiro e bancário", nature: "opex", cut: "estrategico", re: /(tarifa|banc|juros|multa|iof|desconto de titul|antecipa)/i },
  { cat: "Terceiros e sublocação", nature: "opex", cut: "estrategico", re: /(subloc|terceir|prestador|autonom|autônom|mao de obra|mão de obra)/i },
];

export const CUT_LABEL = {
  alto: "Alto potencial de corte",
  estrategico: "Cortar com critério",
  estrutural: "Estrutural — redimensionar",
  contratual: "Contratual — pouco flexível",
  indefinido: "A classificar",
  neutro: "Movimentação entre contas",
};

export function classifyAccount(row) {
  const bloco = BLOCOS[String(row.bloco || "")];
  if (bloco) return bloco;
  const text = `${row.ds_bloco || ""} ${row.ds_planfin || ""}`;
  for (const r of CAT_RULES) if (r.re.test(text)) return { categoria: r.cat, natureza: r.nature, corte: r.cut };
  if (String(row.nr_planfin || "").startsWith("1"))
    return { categoria: "Conta de entrada usada no contas a pagar", natureza: "movimentacao", corte: "neutro" };
  return { categoria: "Não classificado", natureza: "opex", corte: "indefinido" };
}

export function summarizeCap(cap = []) {
  const contas = cap
    .filter((c) => c.vl_12m > 0)
    .map((c) => ({ ...c, ...classifyAccount(c) }))
    .filter((c) => c.natureza !== "movimentacao");
  const total = contas.reduce((s, c) => s + c.vl_12m, 0);
  const byCat = {};
  const byCut = {};
  for (const c of contas) {
    if (!byCat[c.categoria]) byCat[c.categoria] = { categoria: c.categoria, natureza: c.natureza, corte: c.corte, valor: 0, contas: [] };
    byCat[c.categoria].valor += c.vl_12m;
    byCat[c.categoria].contas.push(c);
    byCut[c.corte] = (byCut[c.corte] || 0) + c.vl_12m;
  }
  const categorias = Object.values(byCat)
    .map((c) => ({ ...c, share: total ? (c.valor / total) * 100 : 0, contas: c.contas.sort((a, b) => b.vl_12m - a.vl_12m).slice(0, 12) }))
    .sort((a, b) => b.valor - a.valor);
  return {
    total,
    capex: categorias.filter((c) => c.natureza === "capex").reduce((s, c) => s + c.valor, 0),
    opex: categorias.filter((c) => c.natureza === "opex").reduce((s, c) => s + c.valor, 0),
    categorias,
    cortes: Object.entries(byCut)
      .map(([corte, valor]) => ({ corte, label: CUT_LABEL[corte], valor, share: total ? (valor / total) * 100 : 0 }))
      .sort((a, b) => b.valor - a.valor),
  };
}

// Vida útil de referência do mercado de locação (anos), por família.
const LIFE_RULES = [
  { re: /(plataforma|mastro|tesoura|low level)/i, life: 10 },
  { re: /(multidirecion|andaime|escorament|fachadeiro|tubular|tubo equipado|estrutura|sapata|ancorag)/i, life: 20 },
  { re: /(veicul|veícul|caminh)/i, life: 8 },
  { re: /(betoneira|compactador|rolo|gerador|torre|bomba|vibrador|cortadora|placa)/i, life: 7 },
  { re: /(martelo|rompedor|martelete|ferrament|serra|ponteiro|talhadeira)/i, life: 5 },
];

export function usefulLife(grupo = "") {
  for (const r of LIFE_RULES) if (r.re.test(grupo)) return r.life;
  return 10;
}

// Custo de posse anual = depreciação linear (valor / vida útil) + manutenção dos últimos 12 meses.
export function ownershipRanking(grupos = []) {
  const rows = grupos.map((g) => {
    const vida = usefulLife(g.grupo);
    const depreciacao = g.vl_total / vida;
    const posse = depreciacao + g.manutencao_12m;
    return {
      ...g,
      vida_util: vida,
      depreciacao,
      custo_posse: posse,
      posse_pct: g.vl_total ? (posse / g.vl_total) * 100 : 0,
      manut_pct: g.vl_total ? (g.manutencao_12m / g.vl_total) * 100 : 0,
    };
  });
  const total = rows.reduce((s, r) => s + r.custo_posse, 0);
  return rows
    .map((r) => ({ ...r, posse_share: total ? (r.custo_posse / total) * 100 : 0 }))
    .sort((a, b) => b.custo_posse - a.custo_posse);
}

const FAMILY_MATCH = {
  plataformas: /plataforma|mastro|tesoura|low level/i,
  andaimes: /multidirecion|andaime|escorament|fachadeiro|tubular|tubo equipado|sapata|ancorag|estrutura/i,
};

export function familyCompare(ranking = []) {
  const build = (key) => {
    const items = ranking.filter((r) => FAMILY_MATCH[key].test(r.grupo));
    const valor = items.reduce((s, r) => s + r.vl_total, 0);
    const manut = items.reduce((s, r) => s + r.manutencao_12m, 0);
    const dep = items.reduce((s, r) => s + r.depreciacao, 0);
    return {
      key,
      valor,
      manutencao: manut,
      depreciacao: dep,
      custo_posse: manut + dep,
      manut_pct: valor ? (manut / valor) * 100 : 0,
      posse_pct: valor ? ((manut + dep) / valor) * 100 : 0,
      grupos: items.length,
      os: items.reduce((s, r) => s + r.qtd_os, 0),
    };
  };
  return { plataformas: build("plataformas"), andaimes: build("andaimes") };
}