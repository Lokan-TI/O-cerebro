// Análise RFM: notas 1–5 por quintil (R = dias desde a última NF, F = nº de NFs, M = receita).
export const SEGMENTS = {
  nao: { label: "Não posso perdê-los", color: "bg-rose-500/80" },
  risco: { label: "Em risco", color: "bg-orange-400/80" },
  fieis: { label: "Clientes fiéis", color: "bg-slate-500/80" },
  campeoes: { label: "Campeões", color: "bg-sky-500/90" },
  atencao: { label: "Precisam de atenção", color: "bg-yellow-400/80" },
  potenciais: { label: "Potenciais fiéis", color: "bg-emerald-400/80" },
  perdidos: { label: "Perdidos", color: "bg-red-700/80" },
  hibernando: { label: "Hibernando", color: "bg-slate-300/70" },
  hibernar: { label: "Prestes a hibernar", color: "bg-cyan-300/70" },
  promissores: { label: "Promissores", color: "bg-violet-400/80" },
  recentes: { label: "Clientes recentes", color: "bg-teal-500/80" },
};

// Linhas = FM 5→1, colunas = R 1→5 (cada segmento é um retângulo).
export const GRID = [
  ["nao", "nao", "fieis", "fieis", "campeoes"],
  ["risco", "risco", "fieis", "fieis", "campeoes"],
  ["risco", "risco", "atencao", "potenciais", "potenciais"],
  ["perdidos", "hibernando", "hibernar", "potenciais", "potenciais"],
  ["perdidos", "hibernando", "hibernar", "promissores", "recentes"],
];

function quintile(values, v) {
  const below = values.filter((x) => x < v).length;
  return Math.min(5, Math.floor((below / values.length) * 5) + 1);
}

export function rfmWindow(year) {
  const today = new Date().toISOString().slice(0, 10);
  const end = String(year) === today.slice(0, 4) ? today : `${year}-12-31`;
  const d = new Date(end + "T00:00:00");
  d.setFullYear(d.getFullYear() - 1);
  d.setDate(d.getDate() + 1);
  return { start: d.toISOString().slice(0, 10), end };
}

export function computeRfm(rows, end) {
  const byClient = {};
  rows.forEach((r) => {
    const c = (byClient[r.cd_pessoa] ||= { nm: r.nm_pessoa, receita: 0, nfs: 0, ultima: r.ultima_nf });
    c.receita += r.receita;
    c.nfs += r.nfs;
    if (r.ultima_nf > c.ultima) c.ultima = r.ultima_nf;
  });
  const clients = Object.values(byClient);
  const endMs = new Date(end + "T00:00:00").getTime();
  clients.forEach((c) => (c.dias = Math.round((endMs - new Date(c.ultima + "T00:00:00").getTime()) / 864e5)));
  const negDias = clients.map((c) => -c.dias), nfs = clients.map((c) => c.nfs), rec = clients.map((c) => c.receita);
  const dist = { R: [0, 0, 0, 0, 0], F: [0, 0, 0, 0, 0], M: [0, 0, 0, 0, 0] };
  const segs = Object.fromEntries(Object.keys(SEGMENTS).map((k) => [k, { qtd: 0, receita: 0 }]));
  clients.forEach((c) => {
    const R = quintile(negDias, -c.dias), F = quintile(nfs, c.nfs), M = quintile(rec, c.receita);
    dist.R[R - 1]++; dist.F[F - 1]++; dist.M[M - 1]++;
    const seg = GRID[5 - Math.round((F + M) / 2)][R - 1];
    segs[seg].qtd++; segs[seg].receita += c.receita;
  });
  return { total: clients.length, receita: rec.reduce((s, v) => s + v, 0), dist, segs };
}