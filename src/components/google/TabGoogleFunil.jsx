import { useMemo, useState } from "react";
import { CLIENTES_WON, RESUMO, getCategoriaFromProduto } from "@/components/google/googleData.jsx";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { ChevronDown, ChevronUp, Users, TrendingUp, X } from "lucide-react";

const fmtR = (v) => "R$ " + (v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const STEP_META = {
  "Cohort (estimado)": { color: "#3b82f6", desc: "Total de leads atribuídos ao Google Ads (first-touch)" },
  "OPEN (Ativos)":     { color: "#6b7280", desc: "Leads ainda em negociação — conversão futura possível" },
  "LOST (Encerrados)": { color: "#ef4444", desc: "Leads encerrados sem nenhum fechamento" },
  "WON (Fechados)":    { color: "#22c55e", desc: "Leads que fecharam ao menos 1 negócio" },
  "Com Recompra":      { color: "#a855f7", desc: "Clientes WON que fizeram 2º fechamento ou mais" },
};

function CustomTooltip({ active, payload, label, cohortTotal }) {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value;
  const meta = STEP_META[label] || {};
  const pct = cohortTotal > 0 ? ((val / cohortTotal) * 100).toFixed(1) : "—";
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 shadow-2xl min-w-[220px]">
      <p className="text-white font-bold text-sm mb-1">{label}</p>
      <p className="text-2xl font-bold" style={{ color: meta.color }}>{val} clientes</p>
      <p className="text-gray-400 text-xs mt-1">{pct}% do cohort</p>
      <p className="text-gray-500 text-xs mt-2 border-t border-gray-700 pt-2">{meta.desc}</p>
    </div>
  );
}

function DrillDown({ step, clientes, onClose }) {
  const [sort, setSort] = useState({ key: "receita_total", dir: -1 });

  const sorted = useMemo(() => {
    return [...clientes].sort((a, b) => (a[sort.key] > b[sort.key] ? sort.dir : -sort.dir));
  }, [clientes, sort]);

  const toggleSort = (key) =>
    setSort(prev => ({ key, dir: prev.key === key ? -prev.dir : -1 }));

  const totalReceita = clientes.reduce((s, c) => s + c.receita_total, 0);
  const totalRetido  = clientes.reduce((s, c) => s + c.retido, 0);

  const Th = ({ k, label }) => (
    <th
      className="text-left text-xs text-gray-400 uppercase tracking-wider pb-2 cursor-pointer hover:text-white transition-colors select-none"
      onClick={() => toggleSort(k)}
    >
      <span className="flex items-center gap-1">
        {label}
        {sort.key === k ? (sort.dir === -1 ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />) : null}
      </span>
    </th>
  );

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Users className="w-4 h-4 text-green-400" />
          <h3 className="text-white font-semibold text-sm">
            {step} — {clientes.length} clientes
          </h3>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Totais rápidos */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-gray-800 rounded-lg p-3">
          <p className="text-gray-500 text-xs mb-1">Clientes</p>
          <p className="text-white font-bold text-lg">{clientes.length}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-3">
          <p className="text-gray-500 text-xs mb-1">Receita Total</p>
          <p className="text-green-400 font-bold text-sm">{fmtR(totalReceita)}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-3">
          <p className="text-gray-500 text-xs mb-1">Retido (Recompra)</p>
          <p className="text-purple-400 font-bold text-sm">{fmtR(totalRetido)}</p>
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-auto max-h-64">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-gray-900 border-b border-gray-700">
            <tr>
              <Th k="cliente"       label="Cliente" />
              <Th k="resp"          label="Resp." />
              <Th k="produto"       label="Produto" />
              <Th k="fechados_pos"  label="Recompras" />
              <Th k="receita_total" label="Receita" />
              <Th k="retido"        label="Retido" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {sorted.map((c) => (
              <tr key={c.cliente} className="hover:bg-gray-800/60 transition-colors">
                <td className="py-1.5 text-white font-medium truncate max-w-[140px]">{c.cliente}</td>
                <td className="py-1.5 text-gray-400">{c.resp}</td>
                <td className="py-1.5 text-gray-400">{c.produto}</td>
                <td className="py-1.5 text-center">
                  {c.fechados_pos > 0
                    ? <span className="text-purple-400 font-semibold">{c.fechados_pos}×</span>
                    : <span className="text-gray-600">—</span>}
                </td>
                <td className="py-1.5 text-green-400 text-right">{fmtR(c.receita_total)}</td>
                <td className="py-1.5 text-right">
                  {c.retido > 0
                    ? <span className="text-purple-400">{fmtR(c.retido)}</span>
                    : <span className="text-gray-600">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function TabGoogleFunil({ categoria = "Todos" }) {
  const [activeStep, setActiveStep] = useState(null);
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const filtrados = useMemo(() =>
    categoria === "Todos"
      ? CLIENTES_WON
      : CLIENTES_WON.filter(c => getCategoriaFromProduto(c.produto) === categoria),
    [categoria]
  );

  const won         = filtrados.length;
  const comRecompra = filtrados.filter(c => c.fechados_pos > 0).length;
  const propFiltro  = categoria === "Todos" ? 1 : won / RESUMO.clientes_won;
  const open        = categoria === "Todos" ? 298 : Math.round(298 * propFiltro);
  const lost        = categoria === "Todos" ? 93  : Math.round(93  * propFiltro);
  const cohortTotal = won + open + lost;

  const conversionSteps = [
    { step: "Cohort (estimado)", clientes: cohortTotal },
    { step: "OPEN (Ativos)",     clientes: open },
    { step: "LOST (Encerrados)", clientes: lost },
    { step: "WON (Fechados)",    clientes: won },
    { step: "Com Recompra",      clientes: comRecompra },
  ];

  const taxaWon         = cohortTotal > 0 ? won / cohortTotal : 0;
  const taxaLost        = cohortTotal > 0 ? lost / cohortTotal : 0;
  const taxaRecompraWon = won > 0 ? comRecompra / won : 0;
  const taxaRecompraCoh = cohortTotal > 0 ? comRecompra / cohortTotal : 0;

  // Mapeia step → clientes WON para drill-down
  const drillMap = {
    "WON (Fechados)": filtrados,
    "Com Recompra":   filtrados.filter(c => c.fechados_pos > 0),
  };

  const handleBarClick = (data) => {
    if (!data?.activePayload?.[0]) return;
    const step = data.activePayload[0].payload.step;
    if (!drillMap[step]) return;
    setActiveStep(prev => (prev === step ? null : step));
  };

  return (
    <div className="space-y-6">
      {categoria !== "Todos" && (
        <div className="bg-blue-950/40 border border-blue-800 rounded-lg px-4 py-2 text-xs text-blue-300">
          Exibindo apenas produtos da categoria <strong>{categoria}</strong> · {won} clientes WON filtrados
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funil visual — clicável */}
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <h2 className="text-white font-semibold mb-1 text-sm uppercase tracking-wider">
            Funil de Conversão — Google First-Touch
          </h2>
          <p className="text-gray-600 text-xs mb-4">
            Clique em <span className="text-green-400">WON</span> ou <span className="text-purple-400">Recompra</span> para ver os clientes
          </p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={conversionSteps}
              layout="vertical"
              margin={{ left: 0, right: 55 }}
              onClick={handleBarClick}
              style={{ cursor: "pointer" }}
            >
              <XAxis type="number" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey="step"
                tick={({ x, y, payload, index }) => {
                  const step = payload.value;
                  const isClickable = !!drillMap[step];
                  const isActive = activeStep === step;
                  const color = isActive ? "#fff" : isClickable ? "#d1d5db" : "#9ca3af";
                  return (
                    <text x={x} y={y + 4} textAnchor="end" fill={color} fontSize={12}
                      fontWeight={isActive ? "bold" : "normal"}>
                      {step}{isClickable ? " ↗" : ""}
                    </text>
                  );
                }}
                width={145}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={(props) => <CustomTooltip {...props} cohortTotal={cohortTotal} />}
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
              />
              <Bar dataKey="clientes" radius={[0, 6, 6, 0]}
                label={{ position: "right", fill: "#9ca3af", fontSize: 12 }}
                onMouseEnter={(_, i) => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {conversionSteps.map((s, i) => {
                  const meta = STEP_META[s.step];
                  const isActive = activeStep === s.step;
                  const isHovered = hoveredIdx === i;
                  return (
                    <Cell
                      key={i}
                      fill={meta?.color}
                      opacity={isActive || isHovered ? 1 : hoveredIdx !== null || activeStep ? 0.55 : 1}
                      stroke={isActive ? "#fff" : "transparent"}
                      strokeWidth={isActive ? 1.5 : 0}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Cards de taxa */}
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800 space-y-4">
          <h2 className="text-white font-semibold text-sm uppercase tracking-wider mb-2">Taxas de Conversão</h2>
          <div className="space-y-5">
            {[
              { label: "Cohort → WON",      desc: "Leads que fecharam ao menos 1 negócio",   num: won,         den: cohortTotal, pct: taxaWon,         color: "bg-green-500" },
              { label: "Cohort → LOST",     desc: "Leads encerrados sem nenhum fechamento",  num: lost,        den: cohortTotal, pct: taxaLost,        color: "bg-red-500" },
              { label: "WON → Recompra",    desc: "Clientes que fizeram 2º fechamento+",     num: comRecompra, den: won,         pct: taxaRecompraWon, color: "bg-purple-500" },
              { label: "Cohort → Recompra", desc: "Leads do Google que recompraram",         num: comRecompra, den: cohortTotal, pct: taxaRecompraCoh, color: "bg-yellow-500" },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex justify-between mb-1">
                  <span className="text-gray-300 text-sm font-medium">{item.label}</span>
                  <span className="text-white font-bold text-sm">{(item.pct * 100).toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2 mb-1">
                  <div className={`${item.color} h-2 rounded-full transition-all duration-500`} style={{ width: `${Math.min(item.pct * 100, 100)}%` }} />
                </div>
                <p className="text-gray-600 text-xs">{item.num} de {item.den} — {item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Drill-down ao clicar WON ou Recompra */}
      {activeStep && drillMap[activeStep] && (
        <DrillDown
          step={activeStep}
          clientes={drillMap[activeStep]}
          onClose={() => setActiveStep(null)}
        />
      )}

      {/* Bucket cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { bucket: "OPEN", clientes: open, pct: open/cohortTotal, color: "border-blue-500",  sub: "Em negociação ativa — potencial futuro de conversão", badge: "bg-blue-900/40 text-blue-300" },
          { bucket: "LOST", clientes: lost, pct: lost/cohortTotal, color: "border-red-600",   sub: "Encerrados sem nenhum fechamento",                    badge: "bg-red-900/40 text-red-300" },
          { bucket: "WON",  clientes: won,  pct: taxaWon,          color: "border-green-500", sub: "Têm ao menos 1 negócio fechado",                      badge: "bg-green-900/40 text-green-300" },
        ].map((b) => (
          <div
            key={b.bucket}
            className={`bg-gray-900 border-l-4 ${b.color} rounded-lg p-5 transition-all duration-200
              ${b.bucket === "WON" ? "cursor-pointer hover:bg-gray-800/80 hover:scale-[1.02]" : ""}`}
            onClick={() => b.bucket === "WON" && setActiveStep(prev => prev === "WON (Fechados)" ? null : "WON (Fechados)")}
          >
            <div className="flex items-center justify-between">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${b.badge}`}>{b.bucket}</span>
              {b.bucket === "WON" && <TrendingUp className="w-3.5 h-3.5 text-green-500 opacity-70" />}
            </div>
            <p className="text-4xl font-bold text-white mt-3">{b.clientes}</p>
            <p className="text-2xl font-semibold text-gray-400 mt-1">{(b.pct * 100).toFixed(1)}%</p>
            <p className="text-gray-600 text-xs mt-2">{b.sub}</p>
            {b.bucket === "WON" && (
              <p className="text-green-600 text-xs mt-1">clique para ver clientes ↗</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}