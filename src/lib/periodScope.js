// Recorta a série mensal do snapshot pelo período do filtro global e recalcula
// os indicadores derivados (receita, notas, ticket, crescimento) para a janela
// escolhida — e para a janela anterior de mesma duração, usada na comparação.
import { filterEmpresaRows } from "@/lib/empresaScope";

const ym = (dateStr) => {
  const [y, m] = String(dateStr || "").split("-");
  return { ano: Number(y), mes: Number(m) };
};

const idx = (ano, mes) => ano * 12 + (mes - 1);

export function periodMonths(period) {
  const a = ym(period?.start);
  const b = ym(period?.end);
  if (!a.ano || !b.ano) return null;
  const from = idx(a.ano, a.mes);
  // Fim no dia 1º é limite exclusivo (ex.: 2025-01-01 → 2026-01-01 = ano de 2025).
  const endsOnFirst = String(period.end).slice(-2) === "01" && period.end !== period.start;
  const to = idx(b.ano, b.mes) - (endsOnFirst ? 1 : 0);
  const count = to - from + 1;
  return { from, to, count, prevFrom: from - count, prevTo: from - 1 };
}

function aggregate(rows) {
  return rows.reduce(
    (acc, r) => {
      acc.receita += Number(r.valor) || 0;
      acc.nfs += Number(r.nfs) || 0;
      return acc;
    },
    { receita: 0, nfs: 0 }
  );
}

// Retorna { receita, receitaAnt, crescimento, ticket, nfs, monthly, byEmpresa, hasData }
export function scopeByPeriod(snapshot, period, selectedEmpresa) {
  const win = periodMonths(period);
  const all = snapshot?.monthly_revenue || [];
  if (!win || all.length === 0) return { hasData: false };

  const scoped = selectedEmpresa == null
    ? filterEmpresaRows(all)
    : all.filter((r) => Number(r.cd_empresa) === selectedEmpresa);

  const inWindow = (r, from, to) => {
    const i = idx(Number(r.ano), Number(r.mes));
    return i >= from && i <= to;
  };

  const cur = scoped.filter((r) => inWindow(r, win.from, win.to));
  const prev = scoped.filter((r) => inWindow(r, win.prevFrom, win.prevTo));
  if (cur.length === 0 && prev.length === 0) return { hasData: false };

  const a = aggregate(cur);
  const b = aggregate(prev);

  const monthlyMap = cur.reduce((acc, r) => {
    const key = `${r.ano}-${r.mes}`;
    acc[key] = acc[key] || { ano: Number(r.ano), mes: Number(r.mes), valor: 0, nfs: 0 };
    acc[key].valor += Number(r.valor) || 0;
    acc[key].nfs += Number(r.nfs) || 0;
    return acc;
  }, {});

  const empMap = filterEmpresaRows(all)
    .filter((r) => inWindow(r, win.from, win.to))
    .reduce((acc, r) => {
      const cd = Number(r.cd_empresa);
      acc[cd] = acc[cd] || { cd_empresa: cd, receita: 0, nfs: 0 };
      acc[cd].receita += Number(r.valor) || 0;
      acc[cd].nfs += Number(r.nfs) || 0;
      return acc;
    }, {});

  const empPrev = filterEmpresaRows(all)
    .filter((r) => inWindow(r, win.prevFrom, win.prevTo))
    .reduce((acc, r) => {
      const cd = Number(r.cd_empresa);
      acc[cd] = (acc[cd] || 0) + (Number(r.valor) || 0);
      return acc;
    }, {});

  const byEmpresa = new Map(
    Object.values(empMap).map((e) => [
      e.cd_empresa,
      {
        ...e,
        ticket: e.nfs > 0 ? e.receita / e.nfs : 0,
        receita_ant: empPrev[e.cd_empresa] || 0,
        crescimento: empPrev[e.cd_empresa] > 0
          ? ((e.receita - empPrev[e.cd_empresa]) / empPrev[e.cd_empresa]) * 100
          : null,
      },
    ])
  );

  return {
    hasData: true,
    months: win.count,
    receita: a.receita,
    nfs: a.nfs,
    ticket: a.nfs > 0 ? a.receita / a.nfs : 0,
    receitaAnt: b.receita,
    crescimento: b.receita > 0 ? ((a.receita - b.receita) / b.receita) * 100 : null,
    monthly: Object.values(monthlyMap).sort((x, y) => x.ano - y.ano || x.mes - y.mes),
    byEmpresa,
  };
}