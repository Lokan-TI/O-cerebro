import { useState, useMemo } from "react";
import { RESUMO, FUNIL, RETIDO_POR_MES, RECOMPRAS } from "@/components/google/googleData.jsx";
import { isInRange, DATE_RANGE_DEFAULT } from "@/components/google/DateRangeFilter.jsx";
import RadarDesempenho from "@/components/google/RadarDesempenho.jsx";
import TendenciaMensal from "@/components/google/TendenciaMensal.jsx";
import KPICardsDraggable from "@/components/dashboard/KPICardsDraggable.jsx";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, ReferenceLine,
} from "recharts";

const fmt = (v) => v?.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtR = (v) => "R$ " + (v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtPct = (v) => (v * 100).toFixed(1) + "%";

const PIE_COLORS = ["#3b82f6", "#6b7280", "#22c55e"];
const INVESTIMENTO = 200000;

const RECEITA_MES_RAW = [
  { mes: "Jan/25", receita_novos: 0,        recompra: 0,        investimento: 18182 },
  { mes: "Fev/25", receita_novos: 12492.08, recompra: 29772.08, investimento: 18182 },
  { mes: "Mar/25", receita_novos: 28000,    recompra: 0,        investimento: 18182 },
  { mes: "Abr/25", receita_novos: 35000,    recompra: 0,        investimento: 18182 },
  { mes: "Mai/25", receita_novos: 42000,    recompra: 8640,     investimento: 18182 },
  { mes: "Jun/25", receita_novos: 38000,    recompra: 2808,     investimento: 18182 },
  { mes: "Jul/25", receita_novos: 82000,    recompra: 36838.8,  investimento: 18182 },
  { mes: "Ago/25", receita_novos: 68000,    recompra: 29096.5,  investimento: 18182 },
  { mes: "Set/25", receita_novos: 72000,    recompra: 21457.6,  investimento: 18182 },
  { mes: "Out/25", receita_novos: 54000,    recompra: 0,        investimento: 18182 },
  { mes: "Nov/25", receita_novos: 44000,    recompra: 0,        investimento: 0 },
].map(d => ({
  ...d,
  total: d.receita_novos + d.recompra,
  roas_mes: d.investimento > 0 ? (d.receita_novos + d.recompra) / d.investimento : null,
}));

const ROAS = RESUMO.receita_fechado_total / INVESTIMENTO;
const CAC = INVESTIMENTO / RESUMO.clientes_won;
const TAXA_RETENCAO = RESUMO.clientes_recompra / RESUMO.clientes_won;

function CustomBarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="bg-gray-900 border border-blue-700 rounded-xl p-4 shadow-2xl min-w-[200px]">
      <p className="text-blue-400 font-bold text-sm mb-2">{label}</p>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">1º Fechamento</span>
          <span className="text-blue-400 font-semibold">{fmtR(d?.receita_novos)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Recompra</span>
          <span className="text-purple-400 font-semibold">{fmtR(d?.recompra)}</span>
        </div>
        <div className="border-t border-gray-700 pt-1 mt-1 flex justify-between gap-4">
          <span className="text-gray-300 font-medium">Total</span>
          <span className="text-white font-bold">{fmtR(d?.total)}</span>
        </div>
        {d?.roas_mes != null && (
          <div className="flex justify-between gap-4">
            <span className="text-gray-400">ROAS</span>
            <span className="text-yellow-400 font-semibold">{d.roas_mes.toFixed(2)}x</span>
          </div>
        )}
        {d?.investimento > 0 && (
          <div className="flex justify-between gap-4">
            <span className="text-gray-400">Investimento</span>
            <span className="text-gray-300">{fmtR(d.investimento)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function CustomPieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 shadow-xl">
      <p className="text-white font-semibold text-sm">{d.name}</p>
      <p className="text-gray-300 text-xs mt-1">{d.value} clientes</p>
      <p className="text-gray-400 text-xs">{(d.pct * 100).toFixed(1)}% do cohort</p>
    </div>
  );
}

// Mapeamento mes label → YYYY-MM
const MES_TO_YM = {
  "Jan/25": "2025-01", "Fev/25": "2025-02", "Mar/25": "2025-03",
  "Abr/25": "2025-04", "Mai/25": "2025-05", "Jun/25": "2025-06",
  "Jul/25": "2025-07", "Ago/25": "2025-08", "Set/25": "2025-09",
  "Out/25": "2025-10", "Nov/25": "2025-11",
};

export default function TabGoogleOverview({ dateRange = DATE_RANGE_DEFAULT }) {
  const [selectedMes, setSelectedMes] = useState(null);
  const [activePie, setActivePie] = useState(null);

  // Filtra os dados mensais pelo intervalo de datas selecionado
  const receitaMes = useMemo(() =>
    RECEITA_MES_RAW.filter(d => {
      const ym = MES_TO_YM[d.mes];
      return ym >= dateRange.from && ym <= dateRange.to;
    }),
    [dateRange]
  );

  const pieData = FUNIL.map(f => ({
    name: f.bucket.replace(" (só ATIVO)", "").replace(" (só ENCERRADO)", "").replace(" (tem FECHADO)", ""),
    value: f.clientes,
    pct: f.pct,
  }));

  const mesSelecionado = receitaMes.find(d => d.mes === selectedMes);

  const recomprasMes = selectedMes
    ? RECOMPRAS.filter(r => {
        const ym = MES_TO_YM[selectedMes];
        return ym && r.data.startsWith(ym);
      })
    : [];

  const mediaRoas = receitaMes.filter(d => d.roas_mes).reduce((s, d) => s + d.roas_mes, 0) /
    (receitaMes.filter(d => d.roas_mes).length || 1);

  return (
    <div className="space-y-6">
      {/* Banner ROAS/CAC/Retenção */}
      <KPICardsDraggable cards={[
        { label: "Investimento", value: "R$ 200k", sub: "período Jan–Nov/25", accent: "border-blue-800" },
        { label: "ROAS", value: `${ROAS.toFixed(2)}x`, sub: `R$ ${ROAS.toFixed(2)} gerados por R$ 1`, accent: "border-green-500" },
        { label: "CAC", value: fmtR(CAC), sub: "custo por cliente convertido", accent: "border-purple-500" },
        { label: "Taxa de Retenção", value: fmtPct(TAXA_RETENCAO), sub: `${RESUMO.clientes_recompra} de ${RESUMO.clientes_won} WON`, accent: "border-yellow-500" },
      ]} />

      {/* Radar de Desempenho */}
      <RadarDesempenho />

      {/* KPIs principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Cohort Google (leads)", value: fmt(RESUMO.cohort_total), sub: "first-touch via Google", accent: "border-blue-500" },
          { label: "Conversão para FECHADO", value: fmtPct(RESUMO.taxa_conversao), sub: `${RESUMO.clientes_won} clientes convertidos`, accent: "border-green-500" },
          { label: "Receita Total FECHADO", value: fmtR(RESUMO.receita_fechado_total), sub: "todos os fechamentos do cohort", accent: "border-blue-400" },
          { label: "$$ Retido (pós 1º FECHADO)", value: fmtR(RESUMO.retido_pos_primeiro), sub: `${fmtPct(RESUMO.share_retido)} da receita total`, accent: "border-yellow-500" },
        ].map(kpi => (
          <div key={kpi.label} className={`bg-gray-900 border-l-4 ${kpi.accent} rounded-lg p-5`}>
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">{kpi.label}</p>
            <p className="font-bold text-white leading-tight text-2xl">{kpi.value}</p>
            <p className="text-gray-500 text-xs mt-1">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Tendência mensal — leads + conversão */}
      <TendenciaMensal />

      {/* Gráfico mensal interativo */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
          <div>
            <h2 className="text-white font-semibold text-sm uppercase tracking-wider">
              Receita Gerada pelo Google — Evolução Mensal
              <span className="text-blue-500 text-xs ml-2 font-normal normal-case">clique em um mês para detalhar</span>
            </h2>
            <p className="text-gray-500 text-xs mt-0.5">Barras = receita · Linha amarela = ROAS do mês · Linha tracejada = ROAS médio ({mediaRoas.toFixed(1)}x)</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-400 shrink-0 flex-wrap">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500 inline-block" /> 1º Fechamento</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-purple-500 inline-block" /> Recompra</span>
            <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-yellow-400 inline-block" /> ROAS</span>
            {selectedMes && (
              <button onClick={() => setSelectedMes(null)} className="ml-1 px-2 py-1 bg-gray-800 rounded text-gray-300 hover:text-white transition-colors">
                ✕ {selectedMes}
              </button>
            )}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart
            data={receitaMes}
            margin={{ left: 10, right: 50 }}
            onClick={(e) => e?.activeLabel && setSelectedMes(prev => prev === e.activeLabel ? null : e.activeLabel)}
          >
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
            <YAxis yAxisId="left" tickFormatter={(v) => "R$" + (v / 1000).toFixed(0) + "k"} tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => v != null ? v.toFixed(0) + "x" : ""} tick={{ fill: "#fbbf24", fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 12]} />
            <Tooltip content={<CustomBarTooltip />} cursor={{ fill: "rgba(59,130,246,0.08)" }} />
            <ReferenceLine yAxisId="right" y={mediaRoas} stroke="#fbbf2480" strokeDasharray="4 3" strokeWidth={1.5} />
            <Bar yAxisId="left" dataKey="receita_novos" name="1º Fechamento" stackId="a" radius={[0,0,0,0]} cursor="pointer">
              {receitaMes.map((d) => (
                <Cell key={d.mes} fill={d.mes === selectedMes ? "#60a5fa" : "#3b82f6"} opacity={selectedMes && d.mes !== selectedMes ? 0.4 : 1} />
              ))}
            </Bar>
            <Bar yAxisId="left" dataKey="recompra" name="Recompra" stackId="a" radius={[4,4,0,0]} cursor="pointer">
              {receitaMes.map((d) => (
                <Cell key={d.mes} fill={d.mes === selectedMes ? "#c084fc" : "#a855f7"} opacity={selectedMes && d.mes !== selectedMes ? 0.4 : 1} />
              ))}
            </Bar>
            <Line yAxisId="right" type="monotone" dataKey="roas_mes" name="ROAS" stroke="#fbbf24" strokeWidth={2} dot={{ fill: "#fbbf24", r: 4, strokeWidth: 0 }} activeDot={{ r: 7, fill: "#fbbf24" }} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>

        {/* Painel de detalhe do mês selecionado */}
        {selectedMes && mesSelecionado && (
          <div className="mt-4 bg-gray-800 border border-blue-800 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Total do Mês</p>
              <p className="text-white font-bold text-lg">{fmtR(mesSelecionado.total)}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Recompra</p>
              <p className="text-purple-400 font-bold text-lg">{fmtR(mesSelecionado.recompra)}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">ROAS do Mês</p>
              <p className={`font-bold text-lg ${mesSelecionado.roas_mes >= mediaRoas ? "text-green-400" : "text-red-400"}`}>
                {mesSelecionado.roas_mes?.toFixed(2) ?? "—"}x
                <span className="text-xs text-gray-500 ml-1">média: {mediaRoas.toFixed(1)}x</span>
              </p>
            </div>
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Recompras no Mês</p>
              {recomprasMes.length > 0 ? (
                <div className="space-y-0.5 max-h-20 overflow-y-auto">
                  {recomprasMes.map((r, i) => (
                    <p key={i} className="text-xs text-gray-300 truncate">{r.cliente} — <span className="text-yellow-400">{fmtR(r.valor)}</span></p>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600 text-sm">Sem recompras</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* KPIs secundários */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Clientes com Recompra", value: RESUMO.clientes_recompra, sub: "fizeram ≥1 FECHADO futuro", accent: "border-purple-500" },
          { label: "Taxa de Recompra (WON)", value: fmtPct(RESUMO.taxa_recompra_entre_won), sub: "entre quem já converteu", accent: "border-purple-400" },
          { label: "Total de Negócios FECHADOS", value: RESUMO.total_negocios_fechado, sub: "contagem de vendas", accent: "border-gray-500" },
          { label: "Total de Recompras", value: RESUMO.total_recompras, sub: "vendas após o 1º fechamento", accent: "border-gray-500" },
        ].map(kpi => (
          <div key={kpi.label} className={`bg-gray-900 border-l-4 ${kpi.accent} rounded-lg p-5`}>
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">{kpi.label}</p>
            <p className="font-bold text-white leading-tight text-3xl">{kpi.value}</p>
            <p className="text-gray-500 text-xs mt-1">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Funil Pie interativo + resumo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <h2 className="text-white font-semibold mb-1 text-sm uppercase tracking-wider">Distribuição do Cohort Google</h2>
          <p className="text-gray-600 text-xs mb-4">Passe o mouse para ver detalhes</p>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%" cy="45%"
                innerRadius={55}
                outerRadius={95}
                dataKey="value"
                labelLine={false}
                cursor="pointer"
                onMouseEnter={(_, i) => setActivePie(i)}
                onMouseLeave={() => setActivePie(null)}
              >
                {pieData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={PIE_COLORS[i]}
                    opacity={activePie === null || activePie === i ? 1 : 0.4}
                    stroke={activePie === i ? "#fff" : "transparent"}
                    strokeWidth={activePie === i ? 2 : 0}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomPieTooltip />} />
              <Legend formatter={(v) => <span style={{ color: "#d1d5db", fontSize: 12 }}>{v}</span>} iconSize={10} />
            </PieChart>
          </ResponsiveContainer>
          {activePie !== null && (
            <div className="mt-2 text-center">
              <p className="text-white font-semibold">{pieData[activePie]?.name}</p>
              <p className="text-gray-400 text-sm">{pieData[activePie]?.value} clientes · {(pieData[activePie]?.pct * 100).toFixed(1)}% do cohort</p>
            </div>
          )}
        </div>

        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800 space-y-4">
          <h2 className="text-white font-semibold text-sm uppercase tracking-wider">Resumo Analítico — Google Cohort</h2>
          {[
            { label: "Leads totais (Google)", value: fmt(RESUMO.cohort_total), color: "text-blue-400" },
            { label: "Converteram para FECHADO", value: `${RESUMO.clientes_won} (${fmtPct(RESUMO.taxa_conversao)})`, color: "text-green-400" },
            { label: "Perdidos (só ENCERRADO)", value: `93 (21.0%)`, color: "text-red-400" },
            { label: "Em aberto (OPEN)", value: `286 (64.7%)`, color: "text-gray-400" },
            { label: "Receita 1º FECHADO", value: fmtR(RESUMO.receita_fechado_total - RESUMO.retido_pos_primeiro), color: "text-blue-300" },
            { label: "$$ Retido após 1º FECHADO", value: fmtR(RESUMO.retido_pos_primeiro), color: "text-yellow-400" },
            { label: "Share de retenção", value: fmtPct(RESUMO.share_retido), color: "text-yellow-300" },
          ].map((item) => (
            <div key={item.label} className="flex justify-between items-center border-b border-gray-800 pb-2">
              <span className="text-gray-400 text-sm">{item.label}</span>
              <span className={`font-semibold text-sm ${item.color}`}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}