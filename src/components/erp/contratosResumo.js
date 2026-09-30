import { getEmpresaLabel } from "@/lib/empresaLabels";

const num = (v) => Number(v) || 0;

// Resumo no padrão da Ficha de Locação do Sisloc: fichas "Aberta" por empresa
export function buildResumo(rows) {
  const map = new Map();
  for (const r of rows) {
    const k = String(r.cd_empresa);
    const e = map.get(k) || { cd_empresa: r.cd_empresa, fichas: new Set(), clientes: new Set(), itens: 0, qtEnv: 0, qtDev: 0, vlLoc: 0 };
    e.fichas.add(r.cd_controle); e.clientes.add(r.cd_pessoa);
    e.itens++; e.qtEnv += num(r.qt_remessa); e.qtDev += num(r.qt_devolvida);
    const s = num(r.qt_remessa) - num(r.qt_devolvida);
    if (s > 0) e.vlLoc += s * num(r.vl_uni_locacao);
    map.set(k, e);
  }
  const linhas = [...map.values()].sort((a, b) => a.cd_empresa - b.cd_empresa).map((e) => ({
    "Empresa": getEmpresaLabel(e.cd_empresa),
    "Status": "Aberta",
    "Fichas": e.fichas.size,
    "Clientes": e.clientes.size,
    "Itens (linhas)": e.itens,
    "Qtd. enviada": e.qtEnv,
    "Qtd. devolvida": e.qtDev,
    "Qtd. em posse": e.qtEnv - e.qtDev,
    "Vl. locação em posse": e.vlLoc,
  }));
  if (linhas.length > 1) {
    const t = { "Empresa": "TOTAL", "Status": "Aberta" };
    for (const c of ["Fichas", "Clientes", "Itens (linhas)", "Qtd. enviada", "Qtd. devolvida", "Qtd. em posse", "Vl. locação em posse"])
      t[c] = linhas.reduce((s, l) => s + l[c], 0);
    linhas.push(t);
  }
  return linhas;
}