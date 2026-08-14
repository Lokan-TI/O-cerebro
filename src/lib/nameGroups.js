// Agrupa clientes com nome quase idêntico e documentos (CNPJ/CPF) diferentes.
// Heurística documentada: nome normalizado (sem acento, sem sufixo societário,
// sem pontuação) → chave = primeiros 2 tokens significativos. Grupo relevante =
// mais de um documento distinto sob a mesma chave.

const SUFFIXES = new Set([
  "LTDA", "LTD", "ME", "MEI", "EPP", "EIRELI", "SA", "S", "A", "CIA", "E",
  "COMERCIO", "COMERCIAL", "INDUSTRIA", "SERVICOS", "SERVICO", "TRANSPORTES",
  "CONSTRUCOES", "CONSTRUTORA", "ENGENHARIA", "EMPREENDIMENTOS", "PARTICIPACOES",
  "DE", "DA", "DO", "DOS", "DAS",
]);

export function normalizeName(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function nameTokens(name) {
  return normalizeName(name).split(" ").filter((t) => t.length > 1 && !SUFFIXES.has(t));
}

export function nameKey(name) {
  const tokens = nameTokens(name);
  if (tokens.length === 0) return null;
  return tokens.slice(0, 2).join(" ");
}

export function onlyDigits(v) {
  return String(v || "").replace(/\D/g, "");
}

export function clientDocument(c) {
  return onlyDigits(c.fl_tipo_pessoa === "J" ? c.nr_cnpj_pessoa : c.nr_cpf_pessoa || c.nr_cnpj_pessoa);
}

// Retorna grupos ordenados por receita perdida do grupo.
export function buildNameGroups(clients) {
  const map = new Map();
  for (const c of clients || []) {
    const key = nameKey(c.nm_pessoa);
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(c);
  }

  const groups = [];
  for (const [key, members] of map.entries()) {
    const docs = new Set(members.map(clientDocument).filter(Boolean));
    if (members.length < 2 || docs.size < 2) continue;

    const roots = new Set([...docs].filter((d) => d.length === 14).map((d) => d.slice(0, 8)));
    const sameRoot = roots.size === 1 && [...docs].every((d) => d.length === 14);

    groups.push({
      key,
      members: [...members].sort((a, b) => (b.ref_revenue || 0) - (a.ref_revenue || 0)),
      documents: docs.size,
      revenue: members.reduce((s, m) => s + (Number(m.ref_revenue) || 0), 0),
      // Mesma raiz de CNPJ = filiais da mesma empresa. Raízes distintas = grupo
      // econômico provável ou cadastro duplicado a investigar.
      relation: sameRoot ? "filiais" : "grupo_provavel",
    });
  }
  return groups.sort((a, b) => b.revenue - a.revenue);
}