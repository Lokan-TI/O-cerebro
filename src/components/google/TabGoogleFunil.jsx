import { useMemo } from "react";
import { CLIENTES_WON, RESUMO, getCategoriaFromProduto } from "@/components/google/googleData.jsx";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

export default function TabGoogleFunil({ categoria = "Todos" }) {
  const filtrados = useMemo(() =>
    categoria === "Todos"
      ? CLIENTES_WON
      : CLIENTES_WON.filter(c => getCategoriaFromProduto(c.produto) === categoria),
    [categoria]
  );

  const won = filtrados.length;
  const comRecompra = filtrados.filter(c => c.fechados_pos > 0).length;
  // Para OPEN/LOST sem produto no cohort, mantemos proporção do total
  const propFiltro = categoria === "Todos" ? 1 : won / RESUMO.clientes_won;
  const open = categoria === "Todos" ? 298 : Math.round(298 * propFiltro);
  const lost = categoria === "Todos" ? 93  : Math.round(93  * propFiltro);
  const cohortTotal = won + open + lost;

  const conversionSteps = [
    { step: "Cohort (estimado)", clientes: cohortTotal, fill: "#3b82f6" },
    { step: "OPEN (Ativos)",     clientes: open,         fill: "#6b7280" },
    { step: "LOST (Encerrados)", clientes: lost,         fill: "#ef4444" },
    { step: "WON (Fechados)",    clientes: won,          fill: "#22c55e" },
    { step: "Com Recompra",      clientes: comRecompra,  fill: "#a855f7" },
  ];

  const taxaWon      = cohortTotal > 0 ? won / cohortTotal : 0;
  const taxaLost     = cohortTotal > 0 ? lost / cohortTotal : 0;
  const taxaRecompraWon  = won > 0 ? comRecompra / won : 0;
  const taxaRecompraCoh  = cohortTotal > 0 ? comRecompra / cohortTotal : 0;

  return (
    <div className="space-y-6">
      {/* Badge de filtro ativo */}
      {categoria !== "Todos" && (
        <div className="bg-blue-950/40 border border-blue-800 rounded-lg px-4 py-2 text-xs text-blue-300">
          Exibindo apenas produtos da categoria <strong>{categoria}</strong> · {won} clientes WON filtrados
        </div>
      )}

      {/* Funil visual */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <h2 className="text-white font-semibold mb-5 text-sm uppercase tracking-wider">Funil de Conversão — Google First-Touch</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={conversionSteps} layout="vertical" margin={{ left: 0, right: 50 }}>
              <XAxis type="number" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="step" tick={{ fill: "#d1d5db", fontSize: 12 }} width={140} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 6 }} itemStyle={{ color: "#fff" }} formatter={(v) => [`${v} clientes`]} />
              <Bar dataKey="clientes" radius={[0, 6, 6, 0]} label={{ position: "right", fill: "#9ca3af", fontSize: 12 }}>
                {conversionSteps.map((s, i) => <Cell key={i} fill={s.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Cards de taxa */}
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800 space-y-4">
          <h2 className="text-white font-semibold text-sm uppercase tracking-wider mb-2">Taxas de Conversão</h2>
          <div className="space-y-5">
            {[
              { label: "Cohort → WON",      desc: "Leads que fecharam ao menos 1 negócio", num: won,         den: cohortTotal, pct: taxaWon,         color: "bg-green-500" },
              { label: "Cohort → LOST",     desc: "Leads encerrados sem nenhum fechamento", num: lost,        den: cohortTotal, pct: taxaLost,        color: "bg-red-500" },
              { label: "WON → Recompra",    desc: "Clientes que fizeram 2º fechamento+",    num: comRecompra, den: won,         pct: taxaRecompraWon, color: "bg-purple-500" },
              { label: "Cohort → Recompra", desc: "Leads do Google que recompraram",        num: comRecompra, den: cohortTotal, pct: taxaRecompraCoh, color: "bg-yellow-500" },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex justify-between mb-1">
                  <span className="text-gray-300 text-sm font-medium">{item.label}</span>
                  <span className="text-white font-bold text-sm">{(item.pct * 100).toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2 mb-1">
                  <div className={`${item.color} h-2 rounded-full transition-all`} style={{ width: `${Math.min(item.pct * 100, 100)}%` }} />
                </div>
                <p className="text-gray-600 text-xs">{item.num} de {item.den} — {item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bucket detalhado */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { bucket: "OPEN", clientes: open, pct: open/cohortTotal, color: "border-blue-500", sub: "Em negociação ativa — potencial futuro de conversão", badge: "bg-blue-900/40 text-blue-300" },
          { bucket: "LOST", clientes: lost, pct: lost/cohortTotal, color: "border-red-600",  sub: "Encerrados sem nenhum fechamento",                   badge: "bg-red-900/40 text-red-300" },
          { bucket: "WON",  clientes: won,  pct: taxaWon,          color: "border-green-500", sub: "Têm ao menos 1 negócio fechado",                    badge: "bg-green-900/40 text-green-300" },
        ].map((b) => (
          <div key={b.bucket} className={`bg-gray-900 border-l-4 ${b.color} rounded-lg p-5`}>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${b.badge}`}>{b.bucket}</span>
            <p className="text-4xl font-bold text-white mt-3">{b.clientes}</p>
            <p className="text-2xl font-semibold text-gray-400 mt-1">{(b.pct * 100).toFixed(1)}%</p>
            <p className="text-gray-600 text-xs mt-2">{b.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}