import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from "recharts";
import { buildEmpresaComparison, buildEmpresaTips } from "@/lib/empresaComparison";
import { BarChart3, Lightbulb } from "lucide-react";

const TONE = {
  good: "border-emerald-900/60 bg-emerald-950/20 text-emerald-300",
  warn: "border-amber-900/60 bg-amber-950/20 text-amber-300",
  bad: "border-red-900/60 bg-red-950/20 text-red-300",
};

function Chart({ title, benchmark, dataKey, data, unit }) {
  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
      <p className="text-sm text-white font-medium">{title}</p>
      <p className="text-xs text-gray-500 mb-3">{benchmark}</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ left: -10 }}>
          <CartesianGrid stroke="#1f2937" vertical={false} />
          <XAxis dataKey="nome" tick={{ fill: "#6b7280", fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={60} />
          <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} />
          <Tooltip
            contentStyle={{ background: "#0b0f19", border: "1px solid #374151", borderRadius: 8, fontSize: 12 }}
            formatter={(v) => (unit === "%" ? `${Number(v).toFixed(1)}%` : `R$ ${Number(v).toLocaleString("pt-BR")}`)}
          />
          {unit === "%" && <ReferenceLine y={0} stroke="#4b5563" />}
          <Bar dataKey={dataKey} fill="#a855f7" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function EmpresaComparison({ snapshot }) {
  const rows = useMemo(() => buildEmpresaComparison(snapshot), [snapshot]);
  const tips = useMemo(() => buildEmpresaTips(rows), [rows]);
  if (!rows.length) return null;

  return (
    <section className="mt-10">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="w-4 h-4 text-purple-400" />
        <h2 className="text-sm font-semibold text-purple-400 uppercase tracking-wider">Comparativo entre empresas</h2>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Chart title="Faturamento no ano" benchmark="Volume por unidade" dataKey="faturamento" data={rows} unit="R$" />
        <Chart title="Ocupação da frota" benchmark="Benchmark do setor: 60–75%" dataKey="ocupacao" data={rows} unit="%" />
        <Chart title="Crescimento ano a ano" benchmark="Setor cresce 10–15% a.a." dataKey="crescimento" data={rows} unit="%" />
        <Chart title="Churn de contas" benchmark="Benchmark: até 35% ao ano" dataKey="churn" data={rows} unit="%" />
      </div>

      {tips.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wider">Dicas com base no benchmark</h3>
          </div>
          <div className="space-y-2">
            {tips.map((t, i) => (
              <p key={i} className={`text-sm rounded-lg border px-3 py-2 ${TONE[t.tone]}`}>
                {t.text}
              </p>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}