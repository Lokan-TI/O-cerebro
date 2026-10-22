// Classificação e resumo da variação de fichas fechadas entre Período A e Período B.
export const STATUS = {
  parou: { label: "Parou de locar", cls: "bg-red-500/15 text-red-300" },
  queda: { label: "Queda", cls: "bg-orange-500/15 text-orange-300" },
  estavel: { label: "Estável", cls: "bg-gray-500/15 text-gray-300" },
  alta: { label: "Alta", cls: "bg-emerald-500/15 text-emerald-300" },
  novo: { label: "Novo no Período B", cls: "bg-sky-500/15 text-sky-300" },
  so_orc: { label: "Só orçamentos", cls: "bg-violet-500/15 text-violet-300" },
};

export function enrich(c) {
  const diff = c.loc_b - c.loc_a;
  const pct = c.loc_a > 0 ? diff / c.loc_a : null;
  let status = "estavel";
  if (c.loc_a > 0 && c.loc_b === 0) status = "parou";
  else if (diff < 0) status = "queda";
  else if (c.loc_a === 0 && c.loc_b > 0) status = "novo";
  else if (diff > 0) status = "alta";
  else if (c.loc_a === 0 && c.loc_b === 0) status = "so_orc";
  return { ...c, diff, pct, status, orc_diff: c.orc_b - c.orc_a };
}

export function summarize(list) {
  const quedas = list.filter((c) => c.status === "queda" || c.status === "parou");
  const perdidas = quedas.reduce((s, c) => s + -c.diff, 0);
  const top = [...quedas].sort((a, b) => a.diff - b.diff).slice(0, 10);
  const topPerdidas = top.reduce((s, c) => s + -c.diff, 0);
  return {
    total: list.length,
    quedas: quedas.length,
    pararam: quedas.filter((c) => c.status === "parou").length,
    perdidas,
    locA: list.reduce((s, c) => s + c.loc_a, 0),
    locB: list.reduce((s, c) => s + c.loc_b, 0),
    topShare: perdidas ? topPerdidas / perdidas : 0,
    comOrcB: quedas.filter((c) => c.orc_b > 0).length,
    semOrcB: quedas.filter((c) => c.orc_b === 0).length,
    renA: quedas.reduce((s, c) => s + c.ren_a, 0),
    renB: quedas.reduce((s, c) => s + c.ren_b, 0),
    semMov: list.reduce((s, c) => s + c.semmov_a + c.semmov_b, 0),
  };
}

export const fmtD = (d) => (d ? d.split("-").reverse().join("/") : "—");
export const fmtPct = (p) => (p == null ? "—" : `${(p * 100).toFixed(0)}%`);