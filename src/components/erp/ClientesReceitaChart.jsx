import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { fmtCur, fmtNum, fmtMonthLabel } from "@/lib/erpFormat";
import { periodMonths } from "@/lib/periodScope";

export default function ClientesReceitaChart({ monthlyRevenue, carMonthly, selectedEmpresa, period }) {
  const data = useMemo(() => {
    const win = periodMonths(period);
    const rows = (monthlyRevenue || []).filter((r) => {
      if (selectedEmpresa != null && Number(r.cd_empresa) !== selectedEmpresa) return false;
      if (!win) return true;
      const i = Number(r.ano) * 12 + (Number(r.mes) - 1);
      return i >= win.from && i <= win.to;
    });
    const map = {};
    for (const r of rows) {
      const key = `${r.ano}-${String(r.mes).padStart(2, "0")}`;
      if (!map[key]) map[key] = { key, ano: r.ano, mes: r.mes, receita: 0, clientes: 0 };
      map[key].receita += Number(r.valor) || 0;
      map[key].clientes += Number(r.clientes) || 0;
    }
    // Inadimplência (CAR vencido) por mês de emissão — série consolidada do snapshot
    for (const r of carMonthly || []) {
      if (r.vl_vencido == null) continue;
      const key = `${r.ano}-${String(r.mes).padStart(2, "0")}`;
      if (!map[key]) continue;
      map[key].inadimplencia = (map[key].inadimplencia || 0) + (Number(r.vl_vencido) || 0);
    }
    return Object.values(map)
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((m) => ({ ...m, label: fmtMonthLabel(m.mes, m.ano) }));
  }, [monthlyRevenue, carMonthly, selectedEmpresa, period]);

  const hasInadimplencia = data.some((m) => m.inadimplencia != null);

  if (data.length === 0) return null;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h3 className="text-white font-semibold text-sm mb-1">Evolução do faturamento bruto (NF) — clientes ativos</h3>
      <p className="text-xs text-gray-500 mb-4">
        Faturamento bruto de NF (nf.vl_faturamento) da base ativa e nº de clientes faturados no mês · não é receita por grupo Sisloc
        {hasInadimplencia ? " · inadimplência = títulos vencidos em aberto (consolidado, por mês de emissão)" : ""}
        {period ? ` · ${period.start} → ${period.end}` : ""}
      </p>
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
                name === "Clientes ativos" ? [fmtNum(value), "Clientes ativos"] : [fmtCur(value), name]
              }
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line
              yAxisId="receita"
              type="monotone"
              dataKey="receita"
              name="Faturamento bruto (NF)"
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
            {hasInadimplencia && (
              <Line
                yAxisId="receita"
                type="monotone"
                dataKey="inadimplencia"
                name="Inadimplência"
                stroke="#ef4444"
                strokeWidth={2}
                dot={{ r: 3, fill: "#ef4444" }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}