import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip, Legend,
} from "recharts";
import { RESUMO } from "@/components/google/googleData.jsx";

// Benchmarks de referência (setor B2B industrial — estimativa conservadora)
const BENCHMARK = {
  taxa_conversao:     0.08,   // 8%
  taxa_retencao:      0.15,   // 15%
  share_retido:       0.15,   // 15%
  roas:               2.0,    // 2x
  negocios_por_won:   1.20,   // 1.2 negócios por cliente
  cobertura_cohort:   0.30,   // 30% do cohort em alguma etapa útil
};

const INVESTIMENTO = 200000;
const ROAS = RESUMO.receita_fechado_total / INVESTIMENTO;
const TAXA_CONVERSAO = RESUMO.taxa_conversao;
const TAXA_RETENCAO = RESUMO.clientes_recompra / RESUMO.clientes_won;
const SHARE_RETIDO = RESUMO.share_retido;
const NEGOCIOS_POR_WON = RESUMO.total_negocios_fechado / RESUMO.clientes_won;
const COBERTURA = (RESUMO.clientes_won + 93) / RESUMO.cohort_total; // won + lost / total

// Normaliza: real/benchmark * 100, cap 150
function norm(real, bench) {
  return Math.min(Math.round((real / bench) * 100), 150);
}

const DIMENSOES = [
  {
    label: "Conversão",
    desc: "Taxa de leads convertidos para FECHADO",
    real_raw: TAXA_CONVERSAO,
    bench_raw: BENCHMARK.taxa_conversao,
    fmt: (v) => (v * 100).toFixed(1) + "%",
    score: norm(TAXA_CONVERSAO, BENCHMARK.taxa_conversao),
    bench_score: 100,
  },
  {
    label: "Retenção",
    desc: "% de clientes WON que fizeram recompra",
    real_raw: TAXA_RETENCAO,
    bench_raw: BENCHMARK.taxa_retencao,
    fmt: (v) => (v * 100).toFixed(1) + "%",
    score: norm(TAXA_RETENCAO, BENCHMARK.taxa_retencao),
    bench_score: 100,
  },
  {
    label: "ROAS",
    desc: "Retorno sobre investimento em anúncio",
    real_raw: ROAS,
    bench_raw: BENCHMARK.roas,
    fmt: (v) => v.toFixed(2) + "x",
    score: norm(ROAS, BENCHMARK.roas),
    bench_score: 100,
  },
  {
    label: "Share Retido",
    desc: "% da receita total gerada por recompras",
    real_raw: SHARE_RETIDO,
    bench_raw: BENCHMARK.share_retido,
    fmt: (v) => (v * 100).toFixed(1) + "%",
    score: norm(SHARE_RETIDO, BENCHMARK.share_retido),
    bench_score: 100,
  },
  {
    label: "LTV / Won",
    desc: "Negócios médios por cliente convertido",
    real_raw: NEGOCIOS_POR_WON,
    bench_raw: BENCHMARK.negocios_por_won,
    fmt: (v) => v.toFixed(2) + " neg.",
    score: norm(NEGOCIOS_POR_WON, BENCHMARK.negocios_por_won),
    bench_score: 100,
  },
  {
    label: "Cobertura",
    desc: "% do cohort que avançou (won + lost)",
    real_raw: COBERTURA,
    bench_raw: BENCHMARK.cobertura_cohort,
    fmt: (v) => (v * 100).toFixed(1) + "%",
    score: norm(COBERTURA, BENCHMARK.cobertura_cohort),
    bench_score: 100,
  },
];

const radarData = DIMENSOES.map(d => ({
  dimension: d.label,
  Google: d.score,
  Benchmark: d.bench_score,
}));

const scoreGeral = Math.round(DIMENSOES.reduce((s, d) => s + d.score, 0) / DIMENSOES.length);

function grau(score) {
  if (score >= 130) return { label: "Excelente", cor: "text-green-400", bg: "bg-green-900/30 border-green-700" };
  if (score >= 100) return { label: "Acima da Média", cor: "text-blue-400", bg: "bg-blue-900/30 border-blue-700" };
  if (score >= 75)  return { label: "Na Média", cor: "text-yellow-400", bg: "bg-yellow-900/30 border-yellow-700" };
  return { label: "Abaixo da Média", cor: "text-red-400", bg: "bg-red-900/30 border-red-700" };
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const dim = DIMENSOES.find(d => d.label === payload[0]?.payload?.dimension);
  if (!dim) return null;
  return (
    <div className="bg-gray-900 border border-blue-700 rounded-xl p-4 shadow-2xl min-w-[220px]">
      <p className="text-white font-bold text-sm mb-1">{dim.label}</p>
      <p className="text-gray-500 text-xs mb-3">{dim.desc}</p>
      <div className="space-y-1.5 text-xs">
        <div className="flex justify-between gap-4">
          <span className="text-blue-400 font-medium">Google (real)</span>
          <span className="text-white font-semibold">{dim.fmt(dim.real_raw)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-500">Benchmark</span>
          <span className="text-gray-400">{dim.fmt(dim.bench_raw)}</span>
        </div>
        <div className="border-t border-gray-700 pt-1.5 flex justify-between gap-4">
          <span className="text-gray-400">Score</span>
          <span className={`font-bold ${dim.score >= 100 ? "text-green-400" : "text-red-400"}`}>{dim.score}/100</span>
        </div>
      </div>
    </div>
  );
}

export default function RadarDesempenho() {
  const g = grau(scoreGeral);

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-6 gap-3">
        <div>
          <h2 className="text-white font-semibold text-sm uppercase tracking-wider">Radar de Desempenho — Google First-Touch</h2>
          <p className="text-gray-500 text-xs mt-0.5">Score normalizado vs. benchmark B2B industrial (base = 100). Cap em 150.</p>
        </div>
        <div className={`flex items-center gap-3 px-4 py-2 rounded-lg border ${g.bg} shrink-0`}>
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wider leading-none">Score Geral</p>
            <p className={`font-bold text-2xl leading-none mt-1 ${g.cor}`}>{scoreGeral}<span className="text-sm font-normal text-gray-500">/150</span></p>
          </div>
          <span className={`text-sm font-semibold ${g.cor}`}>{g.label}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
        {/* Radar */}
        <ResponsiveContainer width="100%" height={320}>
          <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
            <PolarGrid stroke="#374151" />
            <PolarAngleAxis
              dataKey="dimension"
              tick={{ fill: "#9ca3af", fontSize: 12, fontWeight: 500 }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 150]}
              tick={{ fill: "#4b5563", fontSize: 9 }}
              tickCount={4}
            />
            <Radar
              name="Benchmark"
              dataKey="Benchmark"
              stroke="#6b7280"
              fill="#6b7280"
              fillOpacity={0.1}
              strokeDasharray="4 3"
              strokeWidth={1.5}
            />
            <Radar
              name="Google"
              dataKey="Google"
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.25}
              strokeWidth={2.5}
              dot={{ fill: "#3b82f6", r: 4 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend formatter={(v) => <span style={{ color: v === "Google" ? "#60a5fa" : "#9ca3af", fontSize: 12 }}>{v}</span>} />
          </RadarChart>
        </ResponsiveContainer>

        {/* Tabela de scores */}
        <div className="space-y-3">
          {DIMENSOES.map(d => {
            const pct = Math.min(d.score / 150 * 100, 100);
            const barCor = d.score >= 130 ? "bg-green-500" : d.score >= 100 ? "bg-blue-500" : d.score >= 75 ? "bg-yellow-500" : "bg-red-500";
            const textCor = d.score >= 130 ? "text-green-400" : d.score >= 100 ? "text-blue-400" : d.score >= 75 ? "text-yellow-400" : "text-red-400";
            return (
              <div key={d.label} className="group">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-300 text-sm font-medium">{d.label}</span>
                    <span className="text-gray-600 text-xs hidden group-hover:inline">{d.desc}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs shrink-0">
                    <span className="text-gray-500">{d.fmt(d.real_raw)}</span>
                    <span className={`font-bold w-10 text-right ${textCor}`}>{d.score}</span>
                  </div>
                </div>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${barCor}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="h-px bg-gray-800/0 mt-0.5" />
              </div>
            );
          })}
          <p className="text-gray-600 text-xs pt-1 border-t border-gray-800">
            Benchmark = referência B2B industrial estimada. Score 100 = na média, 150 = teto máximo exibido.
          </p>
        </div>
      </div>
    </div>
  );
}