import { RESUMO, FUNIL } from "@/components/dashboard/googleData.js";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

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

export default function TabGoogleOverview() {
  const pieData = FUNIL.map(f => ({
    name: f.bucket.replace(" (só ATIVO)", "").replace(" (só ENCERRADO)", "").replace(" (tem FECHADO)", ""),
    value: f.clientes,
    pct: f.pct,
  }));

  return (
    <div className="space-y-6">
      {/* KPIs principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI label="Cohort Google (leads)" value={fmt(RESUMO.cohort_total)} sub="first-touch via Google" />
        <KPI label="Conversão para FECHADO" value={fmtPct(RESUMO.taxa_conversao)} sub={`${RESUMO.clientes_won} clientes convertidos`} accent="border-green-500" />
        <KPI label="Receita Total FECHADO" value={fmtR(RESUMO.receita_fechado_total)} sub="todos os fechamentos do cohort" accent="border-blue-400" big />
        <KPI label="$$ Retido (pós 1º FECHADO)" value={fmtR(RESUMO.retido_pos_primeiro)} sub={`${fmtPct(RESUMO.share_retido)} da receita total`} accent="border-yellow-500" big />
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