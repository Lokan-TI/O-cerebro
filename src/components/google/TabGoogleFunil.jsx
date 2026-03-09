import { FUNIL, RESUMO } from "@/components/google/googleData.js";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const fmtPct = (v) => (v * 100).toFixed(1) + "%";

export default function TabGoogleFunil() {
  const conversionSteps = [
    { step: "Cohort Google", clientes: RESUMO.cohort_total, fill: "#3b82f6" },
    { step: "OPEN (Ativos)", clientes: 286, fill: "#6b7280" },
    { step: "LOST (Encerrados)", clientes: 93, fill: "#ef4444" },
    { step: "WON (Fechados)", clientes: 63, fill: "#22c55e" },
    { step: "Com Recompra", clientes: 13, fill: "#a855f7" },
  ];

  return (
    <div className="space-y-6">
      {/* Funil visual */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <h2 className="text-white font-semibold mb-5 text-sm uppercase tracking-wider">Funil de Conversão — Google First-Touch</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={conversionSteps} layout="vertical" margin={{ left: 0, right: 50 }}>
              <XAxis type="number" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="step" tick={{ fill: "#d1d5db", fontSize: 12 }} width={130} axisLine={false} tickLine={false} />
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
              {
                label: "Cohort → WON",
                desc: "Leads do Google que fecharam ao menos 1 negócio",
                num: RESUMO.clientes_won,
                den: RESUMO.cohort_total,
                color: "bg-green-500",
              },
              {
                label: "Cohort → LOST",
                desc: "Leads encerrados sem nenhum fechamento",
                num: 93,
                den: RESUMO.cohort_total,
                color: "bg-red-500",
              },
              {
                label: "WON → Recompra",
                desc: "Clientes que fizeram um 2º fechamento ou mais",
                num: RESUMO.clientes_recompra,
                den: RESUMO.clientes_won,
                color: "bg-purple-500",
              },
              {
                label: "Cohort → Recompra",
                desc: "Todos os leads do Google que recompraram",
                num: RESUMO.clientes_recompra,
                den: RESUMO.cohort_total,
                color: "bg-yellow-500",
              },
            ].map((item) => {
              const pct = item.num / item.den;
              return (
                <div key={item.label}>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-300 text-sm font-medium">{item.label}</span>
                    <span className="text-white font-bold text-sm">{(pct * 100).toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2 mb-1">
                    <div className={`${item.color} h-2 rounded-full transition-all`} style={{ width: `${Math.min(pct * 100, 100)}%` }} />
                  </div>
                  <p className="text-gray-600 text-xs">{item.num} de {item.den} — {item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bucket detalhado */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { bucket: "OPEN", clientes: 286, pct: 0.6471, color: "border-blue-500", sub: "Em negociação ativa — potencial futuro de conversão", badge: "bg-blue-900/40 text-blue-300" },
          { bucket: "LOST", clientes: 93, pct: 0.2104, color: "border-red-600", sub: "Encerrados sem nenhum fechamento", badge: "bg-red-900/40 text-red-300" },
          { bucket: "WON", clientes: 63, pct: 0.1425, color: "border-green-500", sub: "Têm ao menos 1 negócio fechado", badge: "bg-green-900/40 text-green-300" },
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