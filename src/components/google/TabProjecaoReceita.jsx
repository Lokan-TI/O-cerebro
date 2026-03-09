import { useState, useMemo } from "react";
import { RESUMO, CLIENTES_WON, FUNIL } from "@/components/google/googleData.jsx";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import { TrendingUp, Users, DollarSign, Percent } from "lucide-react";

const fmtR = (v) =>
  "R$ " + (v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtK = (v) => {
  if (v >= 1000000) return "R$ " + (v / 1000000).toFixed(1) + "M";
  if (v >= 1000) return "R$ " + (v / 1000).toFixed(0) + "k";
  return fmtR(v);
};

// ── Métricas base do cohort ──────────────────────────────────
const TICKET_MEDIO_FT = CLIENTES_WON.reduce((s, c) => s + c.valor_ft, 0) / CLIENTES_WON.length;
const TICKET_MEDIO_TOTAL = CLIENTES_WON.reduce((s, c) => s + c.receita_total, 0) / CLIENTES_WON.length;
const TAXA_CONV = RESUMO.taxa_conversao; // 66/457
const TAXA_RECOMPRA = RESUMO.clientes_recompra / RESUMO.clientes_won; // 13/66
const TICKET_RECOMPRA =
  CLIENTES_WON.filter((c) => c.fechados_pos > 0).reduce((s, c) => s + c.retido, 0) /
  (CLIENTES_WON.filter((c) => c.fechados_pos > 0).length || 1);

// ── Gera projeção mensal para N novos leads/mês ───────────────
function gerarProjecao(novoLeadsMes, meses = 12) {
  const rows = [];
  let acumulado = 0;
  for (let i = 1; i <= meses; i++) {
    const convertidos = Math.round(novoLeadsMes * TAXA_CONV);
    const receita_ft = convertidos * TICKET_MEDIO_FT;
    const recompras = Math.round(convertidos * TAXA_RECOMPRA);
    const receita_recompra = recompras * TICKET_RECOMPRA;
    const total = receita_ft + receita_recompra;
    acumulado += total;
    rows.push({
      mes: `M+${i}`,
      convertidos,
      receita_ft,
      receita_recompra,
      total,
      acumulado,
    });
  }
  return rows;
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="bg-gray-900 border border-blue-700 rounded-xl p-4 shadow-2xl min-w-[210px]">
      <p className="text-blue-400 font-bold text-sm mb-2">{label}</p>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">1º Fechamento</span>
          <span className="text-blue-400 font-semibold">{fmtR(d?.receita_ft)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Recompra estimada</span>
          <span className="text-purple-400 font-semibold">{fmtR(d?.receita_recompra)}</span>
        </div>
        <div className="border-t border-gray-700 pt-1 mt-1 flex justify-between gap-4">
          <span className="text-gray-300 font-medium">Total do mês</span>
          <span className="text-white font-bold">{fmtR(d?.total)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Acumulado</span>
          <span className="text-yellow-400 font-semibold">{fmtK(d?.acumulado)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Convertidos</span>
          <span className="text-green-400 font-semibold">{d?.convertidos} clientes</span>
        </div>
      </div>
    </div>
  );
}

export default function TabProjecaoReceita() {
  const [leadsInput, setLeadsInput] = useState(50);
  const [horizonte, setHorizonte] = useState(12);

  const projecao = useMemo(() => gerarProjecao(leadsInput, horizonte), [leadsInput, horizonte]);

  const totalConvertidos = projecao.reduce((s, r) => s + r.convertidos, 0);
  const totalFt = projecao.reduce((s, r) => s + r.receita_ft, 0);
  const totalRecompra = projecao.reduce((s, r) => s + r.receita_recompra, 0);
  const totalGeral = totalFt + totalRecompra;

  return (
    <div className="space-y-6">

      {/* Premissas do modelo */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-white font-semibold text-sm uppercase tracking-wider mb-4">
          Premissas do Modelo <span className="text-gray-500 font-normal normal-case text-xs ml-2">(baseadas no cohort real)</span>
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Percent,    label: "Taxa de Conversão",   value: (TAXA_CONV * 100).toFixed(1) + "%",  sub: "leads → clientes",          color: "text-green-400",  border: "border-green-700" },
            { icon: DollarSign, label: "Ticket Médio (1º FT)", value: fmtR(TICKET_MEDIO_FT),              sub: "primeiro fechamento",       color: "text-blue-400",   border: "border-blue-700" },
            { icon: DollarSign, label: "Ticket Médio Recompra", value: fmtR(TICKET_RECOMPRA),             sub: "clientes que recompram",    color: "text-purple-400", border: "border-purple-700" },
            { icon: Percent,    label: "Taxa de Recompra",    value: (TAXA_RECOMPRA * 100).toFixed(1) + "%", sub: "entre clientes WON",      color: "text-yellow-400", border: "border-yellow-700" },
          ].map((item) => (
            <div key={item.label} className={`bg-gray-800 border ${item.border} rounded-lg p-4`}>
              <div className="flex items-center gap-2 mb-2">
                <item.icon className={`w-4 h-4 ${item.color}`} />
                <p className="text-gray-400 text-xs uppercase tracking-wider">{item.label}</p>
              </div>
              <p className={`font-bold text-xl ${item.color}`}>{item.value}</p>
              <p className="text-gray-600 text-xs mt-1">{item.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Controles de simulação */}
      <div className="bg-gray-900 border border-blue-900 rounded-xl p-5">
        <h2 className="text-white font-semibold text-sm uppercase tracking-wider mb-4">
          Simulação de Cenário
        </h2>
        <div className="flex flex-wrap gap-6 items-end">
          <div>
            <label className="text-gray-400 text-xs uppercase tracking-wider block mb-2">
              Novos leads / mês
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={10} max={300} step={5}
                value={leadsInput}
                onChange={(e) => setLeadsInput(Number(e.target.value))}
                className="w-40 accent-blue-500"
              />
              <span className="text-white font-bold text-lg w-12">{leadsInput}</span>
            </div>
          </div>
          <div>
            <label className="text-gray-400 text-xs uppercase tracking-wider block mb-2">
              Horizonte (meses)
            </label>
            <div className="flex gap-2">
              {[6, 12, 18, 24].map((h) => (
                <button
                  key={h}
                  onClick={() => setHorizonte(h)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    horizonte === h ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700"
                  }`}
                >
                  {h}m
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* KPIs da projeção */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Clientes Projetados",   value: totalConvertidos,     fmt: (v) => v,        color: "border-green-500",  text: "text-green-400",  sub: `em ${horizonte} meses` },
          { label: "Receita 1º Fechamento", value: totalFt,              fmt: fmtK,             color: "border-blue-500",   text: "text-blue-400",   sub: "novos clientes" },
          { label: "Receita de Recompras",  value: totalRecompra,        fmt: fmtK,             color: "border-purple-500", text: "text-purple-400", sub: "clientes recorrentes" },
          { label: "Receita Total Projetada", value: totalGeral,         fmt: fmtK,             color: "border-yellow-500", text: "text-yellow-400", sub: `acumulado ${horizonte}m` },
        ].map((kpi) => (
          <div key={kpi.label} className={`bg-gray-900 border-l-4 ${kpi.color} rounded-lg p-5`}>
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">{kpi.label}</p>
            <p className={`font-bold text-2xl ${kpi.text}`}>{kpi.fmt(kpi.value)}</p>
            <p className="text-gray-500 text-xs mt-1">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Gráfico de projeção */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <div className="mb-4">
          <h2 className="text-white font-semibold text-sm uppercase tracking-wider">
            Projeção Mensal de Receita
          </h2>
          <p className="text-gray-500 text-xs mt-0.5">
            Barras = receita mensal · Linha amarela = acumulado · Baseado em {leadsInput} leads/mês com taxa de conversão de {(TAXA_CONV * 100).toFixed(1)}%
          </p>
        </div>
        <div className="flex items-center gap-4 mb-4 text-xs text-gray-400 flex-wrap">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500 inline-block" /> 1º Fechamento</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-purple-500 inline-block" /> Recompra</span>
          <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-yellow-400 inline-block" /> Acumulado</span>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={projecao} margin={{ left: 10, right: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="mes" tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis
              yAxisId="left"
              tickFormatter={(v) => fmtK(v)}
              tick={{ fill: "#6b7280", fontSize: 10 }}
              axisLine={false} tickLine={false}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tickFormatter={(v) => fmtK(v)}
              tick={{ fill: "#fbbf24", fontSize: 10 }}
              axisLine={false} tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(59,130,246,0.06)" }} />
            <Bar yAxisId="left" dataKey="receita_ft" name="1º Fechamento" stackId="a" fill="#3b82f6" radius={[0,0,0,0]} />
            <Bar yAxisId="left" dataKey="receita_recompra" name="Recompra" stackId="a" fill="#a855f7" radius={[4,4,0,0]} />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="acumulado"
              name="Acumulado"
              stroke="#fbbf24"
              strokeWidth={2}
              dot={{ fill: "#fbbf24", r: 3, strokeWidth: 0 }}
              activeDot={{ r: 6, fill: "#fbbf24" }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Tabela de projeção */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="p-4 border-b border-gray-800">
          <h3 className="text-white font-semibold text-sm uppercase tracking-wider">Detalhamento Mensal</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs">
                <th className="text-left px-5 py-3 text-gray-400">Mês</th>
                <th className="text-right px-5 py-3 text-gray-400">Convertidos</th>
                <th className="text-right px-5 py-3 text-gray-400">Receita 1º FT</th>
                <th className="text-right px-5 py-3 text-gray-400">Recompra Est.</th>
                <th className="text-right px-5 py-3 text-gray-400">Total Mês</th>
                <th className="text-right px-5 py-3 text-gray-400">Acumulado</th>
              </tr>
            </thead>
            <tbody>
              {projecao.map((row) => (
                <tr key={row.mes} className="border-b border-gray-800 hover:bg-gray-800 transition-colors">
                  <td className="px-5 py-3 text-gray-300 font-medium">{row.mes}</td>
                  <td className="px-5 py-3 text-right text-green-400 font-semibold">{row.convertidos}</td>
                  <td className="px-5 py-3 text-right text-blue-400">{fmtR(row.receita_ft)}</td>
                  <td className="px-5 py-3 text-right text-purple-400">{fmtR(row.receita_recompra)}</td>
                  <td className="px-5 py-3 text-right text-white font-semibold">{fmtR(row.total)}</td>
                  <td className="px-5 py-3 text-right text-yellow-400 font-bold">{fmtK(row.acumulado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}