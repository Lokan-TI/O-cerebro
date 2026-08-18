import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";
import { fmtCur } from "@/lib/erpFormat";
import { naturezaOf } from "@/lib/planoFinanceiro";
import { CalendarRange } from "lucide-react";

export default function SaidasMensais({ mensal = [] }) {
  const byMes = {};
  for (const r of mensal) {
    const nat = naturezaOf(r.n2.padEnd(9, "0"), "");
    if (nat === "movimentacao") continue;
    if (!byMes[r.mes]) byMes[r.mes] = { mes: r.mes, opex: 0, capex: 0, outros: 0 };
    if (nat === "capex") byMes[r.mes].capex += r.valor;
    else if (nat === "opex") byMes[r.mes].opex += r.valor;
    else byMes[r.mes].outros += r.valor;
  }
  const data = Object.values(byMes).sort((a, b) => a.mes.localeCompare(b.mes));
  if (!data.length) return null;

  return (
    <section className="border border-gray-800 bg-gray-900/50 rounded-xl p-5">
      <h2 className="text-lg font-bold text-white flex items-center gap-2">
        <CalendarRange className="w-5 h-5 text-purple-400" /> Saídas mês a mês
      </h2>
      <p className="text-sm text-gray-400 mt-1 mb-4">Separação entre operação (OPEX), investimento (CAPEX) e saídas ainda sem classificação.</p>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid stroke="#1f2937" vertical={false} />
            <XAxis dataKey="mes" stroke="#6b7280" fontSize={11} />
            <YAxis stroke="#6b7280" fontSize={11} tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} />
            <Tooltip
              contentStyle={{ background: "#0b1120", border: "1px solid #374151", borderRadius: 8 }}
              formatter={(v, n) => [fmtCur(v), n]}
            />
            <Legend />
            <Bar dataKey="opex" name="OPEX" stackId="a" fill="#f59e0b" />
            <Bar dataKey="capex" name="CAPEX" stackId="a" fill="#3b82f6" />
            <Bar dataKey="outros" name="Sem classificação" stackId="a" fill="#6b7280" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}