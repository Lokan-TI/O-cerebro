import { useMemo } from "react";
import { fmtCur } from "@/lib/erpFormat";
import { parseMonthLabel } from "@/lib/finMonthParse";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// Curva acumulada do ano atual vs ano anterior (mesma leitura do dashboard de referência)
export default function FinYoYAccumulated({ rows = [], metric = "car", title = "CAR acumulado — ano atual vs anterior" }) {
  const { data, anos } = useMemo(() => {
    const norm = rows.map((r) => ({ ...r, ...parseMonthLabel(r) }));
    const years = [...new Set(norm.map((r) => r.ano).filter(Boolean))].sort();
    const cur = years[years.length - 1];
    const prev = years[years.length - 2];
    const acc = { [cur]: 0, [prev]: 0 };
    const data = MESES.map((m, idx) => {
      const mes = idx + 1;
      const vCur = norm.find((r) => r.ano === cur && r.mes === mes)?.[metric] || 0;
      const vPrev = norm.find((r) => r.ano === prev && r.mes === mes)?.[metric] || 0;
      acc[cur] += vCur;
      acc[prev] += vPrev;
      const hasCur = norm.some((r) => r.ano === cur && r.mes === mes);
      return {
        label: m,
        atual: hasCur ? acc[cur] : null,
        anterior: prev ? acc[prev] : null,
      };
    });
    return { data, anos: { cur, prev } };
  }, [rows, metric]);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h3 className="text-white font-semibold text-sm mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#222" />
          <XAxis dataKey="label" stroke="#666" fontSize={11} />
          <YAxis stroke="#666" fontSize={11} tickFormatter={(v) => fmtCur(v).replace("R$", "")} />
          <Tooltip contentStyle={{ backgroundColor: "#111", border: "1px solid #333" }} formatter={(v) => fmtCur(v)} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="anterior" name={`Ano anterior (${anos.prev ?? "—"})`} stroke="#64748b" strokeDasharray="5 4" dot={false} />
          <Line type="monotone" dataKey="atual" name={`Ano atual (${anos.cur ?? "—"})`} stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}