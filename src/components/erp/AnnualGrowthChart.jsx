import { useState, useMemo } from "react";
import { useErpSnapshot } from "@/lib/ErpSnapshotContext";
import { useEmpresaFilter } from "@/lib/EmpresaFilterContext";
import { fmtCur, fmtNum } from "@/lib/erpFormat";
import { BarChart3 } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, Cell, ReferenceLine,
} from "recharts";

const MODES = [
  { id: "crescimento", label: "Crescimento %" },
  { id: "faturamento", label: "Faturamento R$" },
  { id: "novos", label: "Novos clientes" },
  { id: "composicao", label: "Novos vs. Base" },
];

export default function AnnualGrowthChart() {
  const { snapshot } = useErpSnapshot();
  const { selectedEmpresa } = useEmpresaFilter();
  const [mode, setMode] = useState("composicao");

  const isAll = selectedEmpresa == null;

  const data = useMemo(() => {
    const rows = isAll
      ? (snapshot?.annual_evolution || [])
      : (snapshot?.annual_evolution_by_empresa || []).filter((r) => Number(r.cd_empresa) === selectedEmpresa);
    const sorted = [...rows].sort((a, b) => a.ano - b.ano);
    return sorted.map((r, i) => {
      const prev = i > 0 ? sorted[i - 1] : null;
      return {
        ...r,
        crescimento: prev && prev.fat_total > 0
          ? ((r.fat_total - prev.fat_total) / prev.fat_total) * 100
          : null,
      };
    });
  }, [snapshot, isAll, selectedEmpresa]);

  if (!snapshot) return null;

  if (data.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-white font-semibold mb-2 text-sm flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-purple-400" /> Evolução anual de crescimento
        </h3>
        <p className="text-gray-500 text-sm">
          Dados de evolução anual ainda não disponíveis neste snapshot. Toque em{" "}
          <span className="text-purple-400">Atualizar dados</span> para recalcular.
        </p>
      </div>
    );
  }

  const tooltipStyle = { backgroundColor: "#111", border: "1px solid #333" };
  const axisMoney = (v) => fmtCur(v).replace("R$", "").trim();

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <h3 className="text-white font-semibold text-sm flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-purple-400" /> Evolução anual de crescimento
        </h3>
        <div className="flex flex-wrap gap-1 bg-gray-950 border border-gray-800 rounded-lg p-1">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                mode === m.id ? "bg-purple-600 text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#222" />
          <XAxis dataKey="ano" stroke="#666" fontSize={12} />

          {mode === "crescimento" && (
            <>
              <YAxis stroke="#666" fontSize={11} tickFormatter={(v) => `${v.toFixed(0)}%`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => (v == null ? "—" : `${v.toFixed(1)}%`)} />
              <ReferenceLine y={0} stroke="#555" />
              <Bar dataKey="crescimento" name="Crescimento vs. ano anterior" radius={[4, 4, 0, 0]}>
                {data.map((d, i) => (
                  <Cell key={i} fill={d.crescimento == null ? "#4b5563" : d.crescimento >= 0 ? "#22c55e" : "#ef4444"} />
                ))}
              </Bar>
            </>
          )}

          {mode === "faturamento" && (
            <>
              <YAxis stroke="#666" fontSize={11} width={80} tickFormatter={axisMoney} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtCur(v)} />
              <Bar dataKey="fat_total" name="Faturamento no ano" fill="#a855f7" radius={[4, 4, 0, 0]} />
            </>
          )}

          {mode === "novos" && (
            <>
              <YAxis stroke="#666" fontSize={11} tickFormatter={fmtNum} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtNum(v)} />
              <Bar dataKey="clientes_novos" name="Novos clientes (1ª compra no ano)" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </>
          )}

          {mode === "composicao" && (
            <>
              <YAxis stroke="#666" fontSize={11} width={80} tickFormatter={axisMoney} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v, name, { payload }) => {
                  const total = (payload.fat_novos || 0) + (payload.fat_base || 0);
                  const pct = total > 0 ? ((v / total) * 100).toFixed(1) : "0";
                  return [`${fmtCur(v)} (${pct}%)`, name];
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="fat_base" name="Receita de clientes da base" stackId="a" fill="#3b82f6" />
              <Bar dataKey="fat_novos" name="Receita de clientes novos" stackId="a" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </>
          )}
        </BarChart>
      </ResponsiveContainer>

      {mode === "composicao" && (
        <p className="text-gray-600 text-xs mt-2">
          Cliente novo = primeira nota fiscal emitida naquele ano (janela de análise de 5 anos). O restante da receita vem de clientes que já estavam na base.
        </p>
      )}
    </div>
  );
}