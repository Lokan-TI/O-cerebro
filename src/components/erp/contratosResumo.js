import { getEmpresaLabel } from "@/lib/empresaLabels";

const num = (v) => Number(v) || 0;

// Resumo no padrão da Ficha de Locação do Sisloc: fichas "Aberta" por empresa (grão ficha)
export function buildResumo(fichas, rows = []) {
  const map = new Map();
  const get = (cd) => {
    const k = String(cd);
    if (!map.has(k)) map.set(k, { cd_empresa: cd, fichas: new Set(), clientes: new Set(), comPosse: new Set(), itens: 0, qtEnv: 0, qtDev: 0, vlLoc: 0 });
    return map.get(k);
  };
  for (const f of fichas) { const e = get(f.cd_empresa); e.fichas.add(f.cd_controle); e.clientes.add(f.cd_pessoa); }
  for (const r of rows) {
    const e = get(r.cd_empresa);
    e.comPosse.add(r.cd_controle);
    e.itens++; e.qtEnv += num(r.qt_remessa); e.qtDev += num(r.qt_devolvida);
    const s = num(r.qt_remessa) - num(r.qt_devolvida);
    if (s > 0) e.vlLoc += s * num(r.vl_uni_locacao);
  }
  const linhas = [...map.values()].sort((a, b) => a.cd_empresa - b.cd_empresa).map((e) => ({
    "Empresa": getEmpresaLabel(e.cd_empresa),
    "Status": "Aberta",
    "Fichas": e.fichas.size,
    "Fichas com bens em posse": e.comPosse.size,
    "Fichas sem bens em posse": e.fichas.size - e.comPosse.size,
    "Clientes": e.clientes.size,
    "Itens (linhas)": e.itens,
    "Qtd. enviada": e.qtEnv,
    "Qtd. devolvida": e.qtDev,
    "Qtd. em posse": e.qtEnv - e.qtDev,
    "Vl. locação em posse": e.vlLoc,
  }));
  if (linhas.length > 1) {
    const t = { "Empresa": "TOTAL", "Status": "Aberta" };
    for (const c of Object.keys(linhas[0]).slice(2)) t[c] = linhas.reduce((s, l) => s + l[c], 0);
    linhas.push(t);
  }
  return linhas;
}