import { useMemo } from "react";
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { fmtCur } from "@/lib/erpFormat";
import { delinquencyCurve } from "@/lib/carRecuperacao";

const short = (v) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : Math.abs(v) >= 1e3 ? `${(v / 1e3).toFixed(0)}k` : String(Math.round(v)));

// Por mês de vencimento: recuperado × em aberto (barras) e % inadimplente (linha).
export default function CarInadimplenciaChart({ curvas }) {
  const data = useMemo(() => delinquencyCurve(curvas), [curvas]);
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h3 className="text-white font-semibold text-sm">Curva de inadimplência</h3>
      <p className="text-xs text-gray-500 mb-4">Por mês de vencimento · % do valor devido que segue vencido sem baixa hoje.</p>
      {!data.length ? <div className="text-gray-600 text-center py-10 text-sm">Sem títulos vencidos no período.</div> : (
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#222" />
            <XAxis dataKey="label" stroke="#666" fontSize={11} />
            <YAxis yAxisId="v" stroke="#666" fontSize={11} tickFormatter={short} />
            <YAxis yAxisId="p" orientation="right" stroke="#f87171" fontSize={11} tickFormatter={(v) => `${v.toFixed(0)}%`} />
            <Tooltip contentStyle={{ backgroundColor: "#111", border: "1px solid #333" }} formatter={(v, n) => (String(n).includes("%") ? `${Number(v).toFixed(2)}%` : fmtCur(v))} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar yAxisId="v" stackId="d" dataKey="recuperado" name="Recebido" fill="#22c55e" />
            <Bar yAxisId="v" stackId="d" dataKey="aberto" name="Vencido em aberto" fill="#ef4444" radius={[4, 4, 0, 0]} />
            <Line yAxisId="p" type="monotone" dataKey="inad" name="Inadimplência %" stroke="#f87171" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}