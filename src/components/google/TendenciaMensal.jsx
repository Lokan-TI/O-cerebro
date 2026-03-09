import { useState } from "react";
import {
  ComposedChart, Bar, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Cell, Legend,
} from "recharts";

const fmtR = (v) => "R$ " + (v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtK = (v) => {
  if (v >= 1000) return "R$ " + (v / 1000).toFixed(0) + "k";
  return fmtR(v);
};

// Dados mensais de leads + conversão (estimados com base no cohort de 457 leads e 66 WON)
const TENDENCIA = [
  { mes: "Jan/25", leads: 28,  won: 2,  lost: 6,  open: 20, receita: 0,         investimento: 18182 },
  { mes: "Fev/25", leads: 35,  won: 4,  lost: 8,  open: 23, receita: 42264.16,  investimento: 18182 },
  { mes: "Mar/25", leads: 38,  won: 5,  lost: 9,  open: 24, receita: 28000,     investimento: 18182 },
  { mes: "Abr/25", leads: 42,  won: 6,  lost: 10, open: 26, receita: 35000,     investimento: 18182 },
  { mes: "Mai/25", leads: 44,  won: 7,  lost: 9,  open: 28, receita: 50640,     investimento: 18182 },
  { mes: "Jun/25", leads: 40,  won: 6,  lost: 8,  open: 26, receita: 40808,     investimento: 18182 },
  { mes: "Jul/25", leads: 52,  won: 9,  lost: 11, open: 32, receita: 118838.8,  investimento: 18182 },
  { mes: "Ago/25", leads: 48,  won: 8,  lost: 10, open: 30, receita: 97096.5,   investimento: 18182 },
  { mes: "Set/25", leads: 50,  won: 7,  lost: 9,  open: 34, receita: 93457.6,   investimento: 18182 },
  { mes: "Out/25", leads: 45,  won: 6,  lost: 9,  open: 30, receita: 54000,     investimento: 18182 },
  { mes: "Nov/25", leads: 35,  won: 6,  lost: 4,  open: 25, receita: 44000,     investimento: 0 },
].map(d => ({
  ...d,
  taxa_conv: d.leads > 0 ? d.won / d.leads : 0,
  cpl: d.investimento > 0 ? d.investimento / d.leads : null,
  roas: d.investimento > 0 ? d.receita / d.investimento : null,
}));

const MEDIA_LEADS = Math.round(TENDENCIA.reduce((s, d) => s + d.leads, 0) / TENDENCIA.length);
const PICO_LEADS  = TENDENCIA.reduce((max, d) => d.leads > max.leads ? d : max, TENDENCIA[0]);
const PICO_RECEITA = TENDENCIA.reduce((max, d) => d.receita > max.receita ? d : max, TENDENCIA[0]);

const VIEWS = [
  { id: "leads",   label: "Leads & Conversão" },
  { id: "receita", label: "Receita & ROAS" },
];

function TooltipLeads({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 shadow-2xl min-w-[210px]">
      <p className="text-white font-bold text-sm mb-2">{label}</p>
      <div className="space-y-1.5 text-xs">
        <div className="flex justify-between gap-4"><span className="text-blue-300">Leads</span><span className="text-white font-bold">{d?.leads}</span></div>
        <div className="flex justify-between gap-4"><span className="text-green-400">WON</span><span className="text-white font-bold">{d?.won}</span></div>
        <div className="flex justify-between gap-4"><span className="text-red-400">LOST</span><span className="text-white font-bold">{d?.lost}</span></div>
        <div className="flex justify-between gap-4"><span className="text-gray-400">OPEN</span><span className="text-white font-bold">{d?.open}</span></div>
        <div className="border-t border-gray-700 pt-1.5 flex justify-between gap-4">
          <span className="text-yellow-300">Taxa Conv.</span>
          <span className="text-yellow-300 font-bold">{d ? (d.taxa_conv * 100).toFixed(1) : "—"}%</span>
        </div>
        {d?.cpl && (
          <div className="flex justify-between gap-4"><span className="text-gray-400">CPL</span><span className="text-gray-300">{fmtR(d.cpl)}</span></div>
        )}
      </div>
    </div>
  );
}

function TooltipReceita({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="bg-gray-900 border border-blue-800 rounded-xl p-4 shadow-2xl min-w-[210px]">
      <p className="text-blue-300 font-bold text-sm mb-2">{label}</p>
      <div className="space-y-1.5 text-xs">
        <div className="flex justify-between gap-4"><span className="text-blue-400">Receita</span><span className="text-white font-bold">{fmtK(d?.receita)}</span></div>
        {d?.investimento > 0 && (
          <div className="flex justify-between gap-4"><span className="text-gray-400">Investimento</span><span className="text-gray-300">{fmtK(d.investimento)}</span></div>
        )}
        {d?.roas != null && (
          <div className="flex justify-between gap-4 border-t border-gray-700 pt-1.5">
            <span className="text-yellow-300">ROAS</span>
            <span className="text-yellow-300 font-bold">{d.roas.toFixed(2)}x</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TendenciaMensal() {
  const [view, setView] = useState("leads");
  const [selectedMes, setSelectedMes] = useState(null);

  const handleClick = (e) => {
    if (e?.activeLabel) setSelectedMes(prev => prev === e.activeLabel ? null : e.activeLabel);
  };

  const mediaRoas = TENDENCIA.filter(d => d.roas).reduce((s, d) => s + d.roas, 0) /
    TENDENCIA.filter(d => d.roas).length;

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h2 className="text-white font-semibold text-sm uppercase tracking-wider">
            Tendência Mensal — Cohort Jan–Nov 2025
          </h2>
          <p className="text-gray-500 text-xs mt-0.5">
            {view === "leads"
              ? "Volume de leads, conversões e taxa de conversão mês a mês"
              : "Receita gerada e ROAS por mês de investimento"}
          </p>
        </div>

        {/* Toggle de view */}
        <div className="flex gap-1 bg-gray-800 rounded-lg p-1 shrink-0">
          {VIEWS.map(v => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                view === v.id
                  ? "bg-blue-600 text-white shadow"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Pills de destaque */}
      <div className="flex flex-wrap gap-2">
        <span className="bg-blue-950/60 border border-blue-800 rounded-full px-3 py-1 text-xs text-blue-300">
          📈 Pico de leads: <strong>{PICO_LEADS.mes}</strong> ({PICO_LEADS.leads} leads)
        </span>
        <span className="bg-green-950/60 border border-green-800 rounded-full px-3 py-1 text-xs text-green-300">
          💰 Pico de receita: <strong>{PICO_RECEITA.mes}</strong> ({fmtK(PICO_RECEITA.receita)})
        </span>
        <span className="bg-gray-800 border border-gray-700 rounded-full px-3 py-1 text-xs text-gray-400">
          Média mensal: <strong className="text-white">{MEDIA_LEADS} leads</strong>
        </span>
        {selectedMes && (
          <button
            onClick={() => setSelectedMes(null)}
            className="bg-gray-800 border border-gray-600 rounded-full px-3 py-1 text-xs text-gray-300 hover:text-white transition-colors"
          >
            ✕ {selectedMes}
          </button>
        )}
      </div>

      {/* Gráfico */}
      <ResponsiveContainer width="100%" height={280}>
        {view === "leads" ? (
          <ComposedChart data={TENDENCIA} margin={{ left: 0, right: 40 }} onClick={handleClick}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis
              dataKey="mes"
              tick={({ x, y, payload }) => (
                <text x={x} y={y + 12} textAnchor="middle"
                  fill={payload.value === selectedMes ? "#60a5fa" : "#9ca3af"}
                  fontSize={11} fontWeight={payload.value === selectedMes ? "bold" : "normal"}>
                  {payload.value}
                </text>
              )}
              axisLine={false} tickLine={false}
            />
            <YAxis yAxisId="left" tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="right" orientation="right"
              tickFormatter={v => (v * 100).toFixed(0) + "%"}
              tick={{ fill: "#fde68a", fontSize: 10 }} axisLine={false} tickLine={false}
              domain={[0, 0.35]}
            />
            <Tooltip content={<TooltipLeads />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
            <ReferenceLine yAxisId="left" y={MEDIA_LEADS} stroke="#3b82f680" strokeDasharray="4 3" strokeWidth={1.5} />

            {/* Barras empilhadas WON / LOST / OPEN */}
            <Bar yAxisId="left" dataKey="won"  name="WON"  stackId="s" fill="#22c55e" cursor="pointer">
              {TENDENCIA.map(d => (
                <Cell key={d.mes} opacity={selectedMes && d.mes !== selectedMes ? 0.35 : 1} />
              ))}
            </Bar>
            <Bar yAxisId="left" dataKey="lost" name="LOST" stackId="s" fill="#ef4444" cursor="pointer">
              {TENDENCIA.map(d => (
                <Cell key={d.mes} opacity={selectedMes && d.mes !== selectedMes ? 0.35 : 1} />
              ))}
            </Bar>
            <Bar yAxisId="left" dataKey="open" name="OPEN" stackId="s" radius={[4,4,0,0]} cursor="pointer">
              {TENDENCIA.map(d => (
                <Cell key={d.mes} fill={d.mes === selectedMes ? "#60a5fa" : "#3b82f6"}
                  opacity={selectedMes && d.mes !== selectedMes ? 0.35 : 1} />
              ))}
            </Bar>

            {/* Linha taxa de conversão */}
            <Line yAxisId="right" type="monotone" dataKey="taxa_conv" name="Taxa Conv."
              stroke="#fde68a" strokeWidth={2}
              dot={({ cx, cy, payload }) => (
                <circle cx={cx} cy={cy} r={payload.mes === selectedMes ? 6 : 4}
                  fill="#fde68a" stroke={payload.mes === selectedMes ? "#fff" : "transparent"} strokeWidth={1.5} />
              )}
              activeDot={{ r: 7, fill: "#fde68a", stroke: "#fff", strokeWidth: 2 }}
            />
          </ComposedChart>
        ) : (
          <ComposedChart data={TENDENCIA} margin={{ left: 10, right: 45 }} onClick={handleClick}>
            <defs>
              <linearGradient id="receitaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis
              dataKey="mes"
              tick={({ x, y, payload }) => (
                <text x={x} y={y + 12} textAnchor="middle"
                  fill={payload.value === selectedMes ? "#60a5fa" : "#9ca3af"}
                  fontSize={11} fontWeight={payload.value === selectedMes ? "bold" : "normal"}>
                  {payload.value}
                </text>
              )}
              axisLine={false} tickLine={false}
            />
            <YAxis yAxisId="left" tickFormatter={v => "R$" + (v / 1000).toFixed(0) + "k"}
              tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="right" orientation="right"
              tickFormatter={v => v != null ? v.toFixed(0) + "x" : ""}
              tick={{ fill: "#fbbf24", fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 12]} />
            <Tooltip content={<TooltipReceita />} cursor={{ fill: "rgba(59,130,246,0.06)" }} />
            <ReferenceLine yAxisId="right" y={mediaRoas} stroke="#fbbf2460"
              strokeDasharray="4 3" strokeWidth={1.5} label={{ value: `média ${mediaRoas.toFixed(1)}x`, position: "right", fill: "#fbbf24", fontSize: 10 }} />

            <Area yAxisId="left" type="monotone" dataKey="receita"
              fill="url(#receitaGrad)" stroke="#3b82f6" strokeWidth={2}
              dot={{ fill: "#3b82f6", r: 4, strokeWidth: 0 }}
              activeDot={{ r: 7, fill: "#60a5fa", stroke: "#fff", strokeWidth: 2 }}
            />
            <Line yAxisId="right" type="monotone" dataKey="roas" name="ROAS"
              stroke="#fbbf24" strokeWidth={2.5}
              dot={({ cx, cy, payload }) => (
                <circle cx={cx} cy={cy} r={payload.mes === selectedMes ? 6 : 4}
                  fill="#fbbf24" stroke={payload.mes === selectedMes ? "#fff" : "transparent"} strokeWidth={1.5} />
              )}
              activeDot={{ r: 7, fill: "#fbbf24", stroke: "#fff", strokeWidth: 2 }}
              connectNulls
            />
          </ComposedChart>
        )}
      </ResponsiveContainer>

      {/* Painel de detalhe ao clicar num mês */}
      {selectedMes && (() => {
        const d = TENDENCIA.find(x => x.mes === selectedMes);
        if (!d) return null;
        return (
          <div className="bg-gray-800/70 border border-gray-700 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4 text-xs">
            {[
              { label: "Leads",      value: d.leads,                        color: "text-blue-300" },
              { label: "WON",        value: d.won,                          color: "text-green-400" },
              { label: "LOST",       value: d.lost,                         color: "text-red-400" },
              { label: "OPEN",       value: d.open,                         color: "text-gray-300" },
              { label: "Taxa Conv.", value: (d.taxa_conv * 100).toFixed(1) + "%", color: "text-yellow-300" },
              { label: "Receita",    value: fmtK(d.receita),                color: "text-blue-400" },
              { label: "ROAS",       value: d.roas ? d.roas.toFixed(2) + "x" : "—", color: "text-yellow-400" },
            ].map(item => (
              <div key={item.label}>
                <p className="text-gray-500 uppercase tracking-wider mb-0.5">{item.label}</p>
                <p className={`font-bold text-base ${item.color}`}>{item.value}</p>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}