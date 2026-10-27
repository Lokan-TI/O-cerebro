// Classifica cada ficha aberta pelas movimentações: saldo em posse = soma (remessado − devolvido) por item.
export const FILTROS = [
  { id: "atual", label: "Todas fichas abertas — somente equipamentos atuais na obra", historico: false },
  { id: "posse", label: "Com patrimônio em posse", historico: false },
  { id: "so_cliente", label: "Sem histórico de movimentações, somente com equipamentos no cliente", historico: false },
  { id: "rem_dev", label: "Com remessas e devoluções", historico: true },
  { id: "so_remessa", label: "Só remessas (sem devolução)", historico: true },
  { id: "devolvidas", label: "Tudo devolvido (sem posse)", historico: true },
  { id: "sem_mov", label: "Sem movimentações", historico: true },
  { id: "todas", label: "Todas abertas (histórico completo)", historico: true },
];

const n = (v) => Number(v) || 0;

export function aplicarFiltro(filtro, fichas, rows) {
  const st = new Map();
  for (const r of rows) {
    const s = st.get(r.cd_controle) || { rem: 0, dev: 0, posse: 0 };
    s.rem += n(r.qt_remessa); s.dev += n(r.qt_devolvida);
    s.posse += Math.max(0, n(r.qt_remessa) - n(r.qt_devolvida));
    st.set(r.cd_controle, s);
  }
  const ok = (f) => {
    const s = st.get(f.cd_controle);
    switch (filtro) {
      case "posse": return s?.posse > 0;
      case "so_cliente": return s?.posse > 0 && s.dev === 0;
      case "rem_dev": return s?.rem > 0 && s.dev > 0;
      case "so_remessa": return s?.rem > 0 && s.dev === 0;
      case "devolvidas": return s?.rem > 0 && s.posse === 0;
      case "sem_mov": return !s;
      default: return true;
    }
  };
  const sel = fichas.filter(ok);
  const ids = new Set(sel.map((f) => f.cd_controle));
  const itens = rows.filter((r) => ids.has(r.cd_controle) && (FILTROS.find((x) => x.id === filtro)?.historico !== false || n(r.qt_remessa) > n(r.qt_devolvida)));
  return { fichas: sel, rows: itens };
}