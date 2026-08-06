import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { fmtCur, fmtNum, fmtMonthLabel } from "@/lib/erpFormat";

export default function ClientesReceitaChart({ monthlyRevenue, selectedEmpresa }) {
  const data = useMemo(() => {
    const rows = (monthlyRevenue || []).filter(
      (r) => selectedEmpresa == null || Number(r.cd_empresa) === selectedEmpresa
    );
    const map = {};
    for (const r of rows) {
      const key = `${r.ano}-${String(r.mes).padStart(2, "0")}`;
      if (!map[key]) map[key] = { key, ano: r.ano, mes: r.mes, receita: 0, clientes: 0 };
      map[key].receita += Number(r.valor) || 0;
      map[key].clientes += Number(r.clientes) || 0;
    }
    return Object.values(map)
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((m) => ({ ...m, label: fmtMonthLabel(m.mes, m.ano) }));
  }, [monthlyRevenue, selectedEmpresa]);

  if (data.length === 0) return null;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h3 className="text-white font-semibold text-sm mb-1">Evolução da receita — clientes ativos</h3>
      <p className="text-xs text-gray-500 mb-4">Receita mensal gerada pela base ativa e nº de clientes faturados no mês</p>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="label" tick={{ fill: "#9ca3af", fontSize: 11 }} />
            <YAxis
              yAxisId="receita"
              tick={{ fill: "#9ca3af", fontSize: 11 }}
              tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`}
            />
            <YAxis
              yAxisId="clientes"
              orientation="right"
              tick={{ fill: "#9ca3af", fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: "#e5e7eb" }}
              formatter={(value, name) =>
                name === "Receita" ? [fmtCur(value), "Receita"] : [fmtNum(value), "Clientes ativos"]
              }
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line
              yAxisId="receita"
              type="monotone"
              dataKey="receita"
              name="Receita"
              stroke="#22c55e"
              strokeWidth={2}
              dot={{ r: 3, fill: "#22c55e" }}
            />
            <Line
              yAxisId="clientes"
              type="monotone"
              dataKey="clientes"
              name="Clientes ativos"
              stroke="#a855f7"
              strokeWidth={2}
              strokeDasharray="4 3"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}