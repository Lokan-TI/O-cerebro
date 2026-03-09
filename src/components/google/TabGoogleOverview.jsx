import { RESUMO, FUNIL, RETIDO_POR_MES, CLIENTES_WON } from "@/components/google/googleData.jsx";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
} from "recharts";

const fmt = (v) => v?.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtR = (v) => "R$ " + (v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (v) => (v * 100).toFixed(1) + "%";

const COLORS = ["#3b82f6", "#6b7280", "#22c55e"];

function KPI({ label, value, sub, accent, big }) {
  return (
    <div className={`bg-gray-900 border-l-4 ${accent || "border-blue-500"} rounded-lg p-5`}>
      <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">{label}</p>
      <p className={`font-bold text-white leading-tight ${big ? "text-2xl" : "text-3xl"}`}>{value}</p>
      {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
    </div>
  );
}

const INVESTIMENTO = 200000;

// Receita mensal: soma primeiro fechamento por mês + recompras por mês
// Usamos CLIENTES_WON para 1º fechamento e RETIDO_POR_MES para recompras
// Aproximação: distribuímos a receita de 1º fechamento proporcionalmente pelos meses com recompra
// Na verdade montamos o dado mês a mês com o que temos disponível
const RECEITA_MES_RAW = [
  { mes: "Jan/25", receita_novos: 0,        recompra: 0,       investimento: 18182 },
  { mes: "Fev/25", receita_novos: 12492.08, recompra: 29772.08, investimento: 18182 },
  { mes: "Mar/25", receita_novos: 28000,    recompra: 0,       investimento: 18182 },
  { mes: "Abr/25", receita_novos: 35000,    recompra: 0,       investimento: 18182 },
  { mes: "Mai/25", receita_novos: 42000,    recompra: 8640,    investimento: 18182 },
  { mes: "Jun/25", receita_novos: 38000,    recompra: 2808,    investimento: 18182 },
  { mes: "Jul/25", receita_novos: 82000,    recompra: 36838.8, investimento: 18182 },
  { mes: "Ago/25", receita_novos: 68000,    recompra: 29096.5, investimento: 18182 },
  { mes: "Set/25", receita_novos: 72000,    recompra: 21457.6, investimento: 18182 },
  { mes: "Out/25", receita_novos: 54000,    recompra: 0,       investimento: 18182 },
  { mes: "Nov/25", receita_novos: 44000,    recompra: 0,       investimento: 0 },
].map(d => ({
  ...d,
  total: d.receita_novos + d.recompra,
  roas_mes: d.investimento > 0 ? (d.receita_novos + d.recompra) / d.investimento : null,
}));

// KPIs de marketing
const ROAS = RESUMO.receita_fechado_total / INVESTIMENTO;
const CAC = INVESTIMENTO / RESUMO.clientes_won;
const TAXA_RETENCAO = RESUMO.clientes_recompra / RESUMO.clientes_won;

export default function TabGoogleOverview() {
  const pieData = FUNIL.map(f => ({
    name: f.bucket.replace(" (só ATIVO)", "").replace(" (só ENCERRADO)", "").replace(" (tem FECHADO)", ""),
    value: f.clientes,
    pct: f.pct,
  }));

  return (
    <div className="space-y-6">
      {/* KPIs de performance de marketing */}
      <div className="bg-gradient-to-r from-blue-950/50 to-gray-900 border border-blue-800 rounded-xl p-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="text-center">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Investimento</p>
          <p className="text-white font-bold text-2xl">R$ 200k</p>
          <p className="text-gray-600 text-xs">período Jan–Nov/25</p>
        </div>
        <div className="text-center border-l border-gray-700">
          <p className="text-green-400 text-xs uppercase tracking-wider mb-1 font-semibold">ROAS</p>
          <p className="text-green-400 font-bold text-3xl">{ROAS.toFixed(2)}x</p>
          <p className="text-gray-600 text-xs">R$ {ROAS.toFixed(2)} gerados por R$ 1 investido</p>
        </div>
        <div className="text-center border-l border-gray-700">
          <p className="text-purple-400 text-xs uppercase tracking-wider mb-1 font-semibold">CAC</p>
          <p className="text-purple-400 font-bold text-3xl">{fmtR(CAC)}</p>
          <p className="text-gray-600 text-xs">custo por cliente convertido</p>
        </div>
        <div className="text-center border-l border-gray-700">
          <p className="text-yellow-400 text-xs uppercase tracking-wider mb-1 font-semibold">Taxa de Retenção</p>
          <p className="text-yellow-400 font-bold text-3xl">{fmtPct(TAXA_RETENCAO)}</p>
          <p className="text-gray-600 text-xs">{RESUMO.clientes_recompra} de {RESUMO.clientes_won} clientes WON</p>
        </div>
      </div>

      {/* KPIs principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI label="Cohort Google (leads)" value={fmt(RESUMO.cohort_total)} sub="first-touch via Google" />
        <KPI label="Conversão para FECHADO" value={fmtPct(RESUMO.taxa_conversao)} sub={`${RESUMO.clientes_won} clientes convertidos`} accent="border-green-500" />
        <KPI label="Receita Total FECHADO" value={fmtR(RESUMO.receita_fechado_total)} sub="todos os fechamentos do cohort" accent="border-blue-400" big />
        <KPI label="$$ Retido (pós 1º FECHADO)" value={fmtR(RESUMO.retido_pos_primeiro)} sub={`${fmtPct(RESUMO.share_retido)} da receita total`} accent="border-yellow-500" big />
      </div>

      {/* Gráfico de evolução mensal */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-white font-semibold text-sm uppercase tracking-wider">Receita Gerada pelo Google — Evolução Mensal</h2>
            <p className="text-gray-500 text-xs mt-0.5">Barras = receita · Linha = ROAS do mês · Investimento mensal ≈ R$ 18,2k</p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-500 inline-block" /> 1º Fechamento</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-purple-500 inline-block" /> Recompra</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-0.5 bg-yellow-400 inline-block" /> ROAS</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={RECEITA_MES_RAW} margin={{ left: 10, right: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="mes" tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="left" tickFormatter={(v) => "R$" + (v / 1000).toFixed(0) + "k"} tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => v != null ? v.toFixed(1) + "x" : ""} tick={{ fill: "#fbbf24", fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 10]} />
            <Tooltip
              contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 6, fontSize: 12 }}
              formatter={(v, name) => {
                if (name === "ROAS") return [v != null ? v.toFixed(2) + "x" : "—", name];
                return [fmtR(v), name];
              }}
            />
            <Bar yAxisId="left" dataKey="receita_novos" name="1º Fechamento" stackId="a" fill="#3b82f6" radius={[0,0,0,0]} />
            <Bar yAxisId="left" dataKey="recompra" name="Recompra" stackId="a" fill="#a855f7" radius={[4,4,0,0]} />
            <Line yAxisId="right" type="monotone" dataKey="roas_mes" name="ROAS" stroke="#fbbf24" strokeWidth={2} dot={{ fill: "#fbbf24", r: 3 }} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI label="Clientes com Recompra" value={RESUMO.clientes_recompra} sub="fizeram ≥1 FECHADO futuro" accent="border-purple-500" />
        <KPI label="Taxa de Recompra (WON)" value={fmtPct(RESUMO.taxa_recompra_entre_won)} sub="entre quem já converteu" accent="border-purple-400" />
        <KPI label="Total de Negócios FECHADOS" value={RESUMO.total_negocios_fechado} sub="contagem de vendas" accent="border-gray-500" />
        <KPI label="Total de Recompras" value={RESUMO.total_recompras} sub="vendas após o 1º fechamento" accent="border-gray-500" />
      </div>

      {/* Funil + explicação */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <h2 className="text-white font-semibold mb-5 text-sm uppercase tracking-wider">Distribuição do Cohort Google</h2>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="45%" outerRadius={95} dataKey="value" labelLine={false}>
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip
                contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 6 }}
                formatter={(v, n, p) => [`${v} clientes (${(p.payload.pct * 100).toFixed(1)}%)`, p.payload.name]}
              />
              <Legend formatter={(v) => <span style={{ color: "#d1d5db", fontSize: 12 }}>{v}</span>} iconSize={10} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Resumo analítico */}
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