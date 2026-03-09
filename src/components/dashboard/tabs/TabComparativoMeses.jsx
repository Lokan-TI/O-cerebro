import { useState, useMemo } from "react";
import { RAW_LEADS } from "@/components/dashboard/leadsData";
import { TrendingUp, TrendingDown } from "lucide-react";

export default function TabComparativoMeses() {
  const [mes1, setMes1] = useState("2025-01");
  const [mes2, setMes2] = useState("2025-02");

  const meses = useMemo(() => {
    const s = new Set(RAW_LEADS.map((l) => l.mes).filter(Boolean));
    return Array.from(s).sort();
  }, []);

  const dados1 = useMemo(() => {
    const filtered = RAW_LEADS.filter((l) => l.mes === mes1);
    return {
      mes: mes1,
      total_leads: filtered.length,
      fechados: filtered.filter((l) => l.status === "FECHADO").length,
      abertos: filtered.filter((l) => l.status === "ATIVO").length,
      perdidos: filtered.filter((l) => l.status === "ENCERRADO").length,
      receita: filtered.reduce((s, l) => s + (l.valor_fechado || 0), 0),
      ticket_medio: filtered.length > 0 ? filtered.reduce((s, l) => s + (l.valor_fechado || 0), 0) / filtered.filter((l) => l.status === "FECHADO").length || 0 : 0,
    };
  }, [mes1]);

  const dados2 = useMemo(() => {
    const filtered = RAW_LEADS.filter((l) => l.mes === mes2);
    return {
      mes: mes2,
      total_leads: filtered.length,
      fechados: filtered.filter((l) => l.status === "FECHADO").length,
      abertos: filtered.filter((l) => l.status === "ATIVO").length,
      perdidos: filtered.filter((l) => l.status === "ENCERRADO").length,
      receita: filtered.reduce((s, l) => s + (l.valor_fechado || 0), 0),
      ticket_medio: filtered.length > 0 ? filtered.reduce((s, l) => s + (l.valor_fechado || 0), 0) / filtered.filter((l) => l.status === "FECHADO").length || 0 : 0,
    };
  }, [mes2]);

  const calcVariacao = (v1, v2) => {
    if (v1 === 0) return v2 > 0 ? 100 : 0;
    return ((v2 - v1) / v1) * 100;
  };

  const KPICard = ({ label, v1, v2, format = (v) => v, sub }) => {
    const variacao = calcVariacao(v1, v2);
    const isPositiva = variacao > 0;
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <p className="text-gray-400 text-xs uppercase tracking-wider mb-3">{label}</p>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div>
            <p className="text-gray-500 text-xs mb-1">Período 1</p>
            <p className="text-white font-bold text-lg">{format(v1)}</p>
          </div>
          <div className="flex items-center justify-center">
            <div className="text-center">
              <p className="text-gray-500 text-xs mb-1">Variação</p>
              <div className={`flex items-center gap-1 font-bold text-lg ${isPositiva ? "text-green-400" : "text-red-400"}`}>
                {isPositiva ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {variacao.toFixed(1)}%
              </div>
            </div>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">Período 2</p>
            <p className="text-white font-bold text-lg">{format(v2)}</p>
          </div>
        </div>
        {sub && <p className="text-gray-600 text-xs">{sub}</p>}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Seletores de mês */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex gap-6 flex-wrap items-end">
        <div>
          <label className="block text-gray-400 text-xs uppercase tracking-wider mb-2">Período 1</label>
          <select
            value={mes1}
            onChange={(e) => setMes1(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          >
            {meses.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-gray-400 text-xs uppercase tracking-wider mb-2">Período 2</label>
          <select
            value={mes2}
            onChange={(e) => setMes2(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          >
            {meses.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid de KPIs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <KPICard
          label="Total de Leads"
          v1={dados1.total_leads}
          v2={dados2.total_leads}
          format={(v) => v}
        />
        <KPICard
          label="Leads Fechados"
          v1={dados1.fechados}
          v2={dados2.fechados}
          format={(v) => v}
        />
        <KPICard
          label="Taxa de Conversão"
          v1={dados1.total_leads > 0 ? (dados1.fechados / dados1.total_leads) * 100 : 0}
          v2={dados2.total_leads > 0 ? (dados2.fechados / dados2.total_leads) * 100 : 0}
          format={(v) => v.toFixed(1) + "%"}
        />
        <KPICard
          label="Receita Total"
          v1={dados1.receita}
          v2={dados2.receita}
          format={(v) => "R$ " + v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
        />
        <KPICard
          label="Ticket Médio"
          v1={dados1.ticket_medio}
          v2={dados2.ticket_medio}
          format={(v) => "R$ " + v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
        />
        <KPICard
          label="Leads Perdidos"
          v1={dados1.perdidos}
          v2={dados2.perdidos}
          format={(v) => v}
        />
      </div>

      {/* Resumo tabular */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="p-4 border-b border-gray-800">
          <h3 className="text-white font-semibold text-sm uppercase tracking-wider">Comparativo Detalhado</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-800/50">
                <th className="text-left px-5 py-3 text-gray-400">Métrica</th>
                <th className="text-center px-5 py-3 text-gray-400">{dados1.mes}</th>
                <th className="text-center px-5 py-3 text-gray-400">Variação</th>
                <th className="text-center px-5 py-3 text-gray-400">{dados2.mes}</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: "Total de Leads", v1: dados1.total_leads, v2: dados2.total_leads, fmt: (v) => v },
                { label: "Leads Fechados", v1: dados1.fechados, v2: dados2.fechados, fmt: (v) => v },
                { label: "Leads Abertos", v1: dados1.abertos, v2: dados2.abertos, fmt: (v) => v },
                { label: "Leads Perdidos", v1: dados1.perdidos, v2: dados2.perdidos, fmt: (v) => v },
                { label: "Taxa de Conversão", v1: dados1.total_leads > 0 ? (dados1.fechados / dados1.total_leads) * 100 : 0, v2: dados2.total_leads > 0 ? (dados2.fechados / dados2.total_leads) * 100 : 0, fmt: (v) => v.toFixed(1) + "%" },
                { label: "Receita Total", v1: dados1.receita, v2: dados2.receita, fmt: (v) => "R$ " + v.toLocaleString("pt-BR", { maximumFractionDigits: 0 }) },
                { label: "Ticket Médio", v1: dados1.ticket_medio, v2: dados2.ticket_medio, fmt: (v) => "R$ " + v.toLocaleString("pt-BR", { maximumFractionDigits: 0 }) },
              ].map((item) => {
                const variacao = calcVariacao(item.v1, item.v2);
                const isPositiva = variacao > 0;
                return (
                  <tr key={item.label} className="border-b border-gray-800 hover:bg-gray-800 transition-colors">
                    <td className="px-5 py-3 text-gray-300 font-medium">{item.label}</td>
                    <td className="px-5 py-3 text-center text-gray-300">{item.fmt(item.v1)}</td>
                    <td className={`px-5 py-3 text-center font-semibold ${isPositiva ? "text-green-400" : "text-red-400"}`}>
                      {isPositiva ? "↑" : "↓"} {variacao.toFixed(1)}%
                    </td>
                    <td className="px-5 py-3 text-center text-gray-300">{item.fmt(item.v2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}