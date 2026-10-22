import { fmtPct } from "./quedaCalc";

const n = (v) => v.toLocaleString("pt-BR");

export default function QuedaSummary({ s }) {
  const kpis = [
    ["Clientes com queda", n(s.quedas), `de ${n(s.total)} com movimento`],
    ["Pararam de locar", n(s.pararam), "fichas em A, nenhuma em B"],
    ["Fichas a menos", n(s.perdidas), "soma das quedas por cliente"],
    ["Fichas fechadas A → B", `${n(s.locA)} → ${n(s.locB)}`, "todos os clientes"],
  ];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map(([t, v, h]) => (
          <div key={t} className="rounded-lg border border-gray-800 bg-gray-950/60 p-3">
            <p className="text-[11px] text-gray-400">{t}</p>
            <p className="text-xl font-semibold text-white mt-0.5">{v}</p>
            <p className="text-[11px] text-gray-500">{h}</p>
          </div>
        ))}
      </div>
      {s.quedas > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="rounded-lg border border-gray-800 p-3 space-y-1.5">
            <p className="font-semibold text-gray-200">Fatos observados</p>
            <p className="text-gray-400">Os 10 clientes com maior queda concentram <b className="text-white">{fmtPct(s.topShare)}</b> das fichas a menos.</p>
            <p className="text-gray-400">Renovações das fichas desses clientes: <b className="text-white">{n(s.renA)}</b> no Período A e <b className="text-white">{n(s.renB)}</b> no Período B (contadas à parte, não somam como fichas).</p>
            <p className="text-gray-400"><b className="text-white">{n(s.comOrcB)}</b> clientes em queda ainda pediram orçamento no Período B; <b className="text-white">{n(s.semOrcB)}</b> não têm orçamento registrado no Período B.</p>
          </div>
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-1.5">
            <p className="font-semibold text-amber-200">Requer investigação</p>
            <p className="text-gray-400">Clientes que pediram orçamento e não fecharam: os dados mostram o interesse, mas não o motivo (preço, prazo, disponibilidade ou concorrência não estão registrados).</p>
            <p className="text-gray-400">Clientes sem orçamento no Período B: não há registro de procura; não é possível afirmar perda para concorrente ou fim de demanda.</p>
            {s.semMov > 0 && <p className="text-gray-400">{n(s.semMov)} fichas não orçamento sem nenhuma movimentação foram excluídas da contagem (não fechadas).</p>}
          </div>
        </div>
      )}
    </div>
  );
}