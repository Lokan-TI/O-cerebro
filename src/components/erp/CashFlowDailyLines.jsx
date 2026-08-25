import { useMemo } from "react";
import {
  LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";
import { Activity } from "lucide-react";

const brl2 = (v) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const short = (v) => {
  const n = Number(v) || 0;
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} mi`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)} mil`;
  return n.toFixed(0);
};
const chartDate = (iso) => {
  if (!iso) return "";
  const [, m, d] = String(iso).split("-");
  return `${d}/${m}`;
};

// Linha única e contínua do caixa dia a dia: passado realizado (por baixa) + futuro esperado
// (CAP/CAR), com entrada em verde e saída em vermelho.
export default function CashFlowDailyLines({ history = [], future = [], asOfDate }) {
  const rows = useMemo(() => {
    const past = history.slice(-90).map(r => ({
      date: r.date,
      label: chartDate(r.date),
      entradas: Number(r.entradas) || 0,
      saidas: Number(r.saidas) || 0,
      tipo: "Realizado",
    }));
    const next = future.map(r => ({
      date: r.date,
      label: chartDate(r.date),
      entradas: Number(r.entradas) || 0,
      saidas: Number(r.saidas) || 0,
      tipo: "Previsto",
    }));
    return [...past, ...next].sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [history, future]);

  if (rows.length === 0) return null;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="mb-3 flex items-center gap-2">
        <Activity className="w-4 h-4 text-cyan-400" />
        <div>
          <h4 className="text-sm font-semibold text-white">Entradas vs. saídas por dia</h4>
          <p className="text-xs text-gray-500">Comparativo diário contínuo: verde = entradas, vermelho = saídas. À esquerda da linha tracejada, valores realizados; à direita, previstos.</p>
        </div>
      </div>
      <div className="h-[380px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 10, right: 15, left: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="label" tick={{ fill: "#6b7280", fontSize: 10 }} minTickGap={26} />
            <YAxis tickFormatter={short} tick={{ fill: "#6b7280", fontSize: 10 }} />
            <Tooltip
              formatter={(v) => brl2(v)}
              labelFormatter={(l, payload) => {
                const tipo = payload?.[0]?.payload?.tipo;
                return tipo ? `${l} · ${tipo}` : l;
              }}
              contentStyle={{ background: "#111827", border: "1px solid #374151" }}
            />
            <Legend />
            {asOfDate && <ReferenceLine x={chartDate(asOfDate)} stroke="#67e8f9" strokeDasharray="4 4" label={{ value: "hoje", fill: "#67e8f9", fontSize: 10, position: "top" }} />}
            <Line type="monotone" dataKey="entradas" name="Entradas" stroke="#10b981" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="saidas" name="Saídas" stroke="#ef4444" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}