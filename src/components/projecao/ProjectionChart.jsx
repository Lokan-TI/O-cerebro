import { fmtCur } from "@/lib/erpFormat";
import {
  ResponsiveContainer, ComposedChart, Area, Line, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ReferenceLine,
} from "recharts";

export default function ProjectionChart({ kpis, rows }) {
  if (!kpis || rows.length === 0) return null;
  const hist = kpis.history.map((h) => ({
    ano: h.ano,
    realizado: h.receita_ref,
  }));
  const proj = rows.map((r) => ({
    ano: r.ano,
    conservador: r.conservador,
    base: r.base,
    otimista: r.otimista,
    capex: r.capex_necessario,
  }));
  const data = [
    ...hist,
    ...proj,
  ];
  // Liga a linha do realizado ao início da projeção
  const bridgeIndex = hist.length - 1;
  if (bridgeIndex >= 0) {
    data[bridgeIndex] = {
      ...data[bridgeIndex],
      conservador: hist[bridgeIndex].realizado,
      base: hist[bridgeIndex].realizado,
      otimista: hist[bridgeIndex].realizado,
    };
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h3 className="text-white font-semibold text-sm mb-1">
        Receita realizada e projetada — {hist.length} anos de histórico + {rows.length} anos de projeção
      </h3>
      <p className="text-xs text-gray-500 mb-4">
        Barras cinza: investimento em frota necessário no cenário base.
      </p>
      <ResponsiveContainer width="100%" height={360}>
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#222" />
          <XAxis dataKey="ano" stroke="#666" fontSize={11} />
          <YAxis stroke="#666" fontSize={11} tickFormatter={(v) => `${Math.round(v / 1e6)}M`} />
          <Tooltip
            contentStyle={{ backgroundColor: "#111", border: "1px solid #333" }}
            formatter={(v) => fmtCur(v)}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <ReferenceLine x={kpis.ano_atual} stroke="#666" strokeDasharray="4 4" />
          <Bar dataKey="capex" name="CAPEX necessário" fill="#3f3f46" radius={[3, 3, 0, 0]} />
          <Area dataKey="otimista" name="Otimista" stroke="#22c55e" fill="#22c55e" fillOpacity={0.08} strokeWidth={2} />
          <Line dataKey="base" name="Base" stroke="#a855f7" strokeWidth={3} dot={false} />
          <Line dataKey="conservador" name="Conservador" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 4" dot={false} />
          <Line dataKey="realizado" name="Realizado" stroke="#22d3ee" strokeWidth={3} dot={{ r: 2 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}