import { useState, useMemo } from "react";
import { RESUMO, RETIDO_POR_MES } from "@/components/google/googleData.jsx";
import { RAW_LEADS } from "@/components/dashboard/leadsData";

// Dados de receita mensal do Google
const RECEITA_MES_RAW = [
  { mes: "2025-01", label: "Jan/25", receita: 0,        roas: null,  investimento: 18182 },
  { mes: "2025-02", label: "Fev/25", receita: 42264.16, roas: 2.33,  investimento: 18182 },
  { mes: "2025-03", label: "Mar/25", receita: 28000,    roas: 1.54,  investimento: 18182 },
  { mes: "2025-04", label: "Abr/25", receita: 35000,    roas: 1.93,  investimento: 18182 },
  { mes: "2025-05", label: "Mai/25", receita: 50640,    roas: 2.79,  investimento: 18182 },
  { mes: "2025-06", label: "Jun/25", receita: 40808,    roas: 2.25,  investimento: 18182 },
  { mes: "2025-07", label: "Jul/25", receita: 118838.8, roas: 6.54,  investimento: 18182 },
  { mes: "2025-08", label: "Ago/25", receita: 97096.5,  roas: 5.34,  investimento: 18182 },
  { mes: "2025-09", label: "Set/25", receita: 93457.6,  roas: 5.14,  investimento: 18182 },
  { mes: "2025-10", label: "Out/25", receita: 54000,    roas: 2.97,  investimento: 18182 },
  { mes: "2025-11", label: "Nov/25", receita: 44000,    roas: null,  investimento: 0 },
];

function getLeadsByMonth(leads, mes) {
  return leads.filter(l => l.mes === mes);
}

function getReceitaByMonth(mes) {
  return RECEITA_MES_RAW.find(d => d.mes === mes) || null;
}

function getRetencaoByMonth(mes) {
  return RETIDO_POR_MES.find(d => d.mes === mes) || null;
}

function delta(a, b) {
  if (a == null || b == null || a === 0) return null;
  return ((b - a) / a) * 100;
}

function DeltaBadge({ pct, invertido = false }) {
  if (pct == null) return <span className="text-gray-600 text-xs">—</span>;
  const positivo = invertido ? pct < 0 : pct > 0;
  const cor = pct === 0 ? "text-gray-400" : positivo ? "text-green-400" : "text-red-400";
  const bg = pct === 0 ? "bg-gray-800" : positivo ? "bg-green-900/30" : "bg-red-900/30";
  const seta = pct === 0 ? "→" : pct > 0 ? "▲" : "▼";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${cor} ${bg}`}>
      {seta} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function ValorCell({ valor, formatar }) {
  if (valor == null) return <span className="text-gray-600">—</span>;
  return <span className="text-white font-semibold">{formatar(valor)}</span>;
}

const fmtR = (v) => "R$ " + (v || 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const fmtN = (v) => (v || 0).toLocaleString("pt-BR");
const fmtX = (v) => v != null ? v.toFixed(2) + "x" : "—";

export default function TabComparativo({ data }) {
  const meses = RECEITA_MES_RAW.map(d => ({ value: d.mes, label: d.label }));

  const [mesA, setMesA] = useState(meses[6]?.value || "");
  const [mesB, setMesB] = useState(meses[8]?.value || "");

  const labelA = meses.find(m => m.value === mesA)?.label || mesA;
  const labelB = meses.find(m => m.value === mesB)?.label || mesB;

  const dadosA = useMemo(() => {
    const rec = getReceitaByMonth(mesA);
    const ret = getRetencaoByMonth(mesA);
    const leads = getLeadsByMonth(data, mesA);
    return {
      receita: rec?.receita ?? null,
      investimento: rec?.investimento ?? null,
      roas: rec?.roas ?? null,
      leads: leads.length || null,
      receita_retida: ret?.receita_retida ?? null,
      clientes_retencao: ret?.clientes ?? null,
    };
  }, [mesA, data]);

  const dadosB = useMemo(() => {
    const rec = getReceitaByMonth(mesB);
    const ret = getRetencaoByMonth(mesB);
    const leads = getLeadsByMonth(data, mesB);
    return {
      receita: rec?.receita ?? null,
      investimento: rec?.investimento ?? null,
      roas: rec?.roas ?? null,
      leads: leads.length || null,
      receita_retida: ret?.receita_retida ?? null,
      clientes_retencao: ret?.clientes ?? null,
    };
  }, [mesB, data]);

  const metricas = [
    {
      grupo: "Google · Receita",
      itens: [
        { label: "Receita Total", campo: "receita", fmt: fmtR, invertido: false },
        { label: "Investimento", campo: "investimento", fmt: fmtR, invertido: false },
        { label: "ROAS", campo: "roas", fmt: fmtX, invertido: false },
      ],
    },
    {
      grupo: "Leads Perdidos",
      itens: [
        { label: "Leads Perdidos", campo: "leads", fmt: fmtN, invertido: true },
      ],
    },
    {
      grupo: "Retenção (Recompra)",
      itens: [
        { label: "Receita Retida", campo: "receita_retida", fmt: fmtR, invertido: false },
        { label: "Clientes com Recompra", campo: "clientes_retencao", fmt: fmtN, invertido: false },
      ],
    },
  ];

  const mesmomes = mesA === mesB;

  return (
    <div className="space-y-6">
      {/* Seletor de meses */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <h2 className="text-white font-semibold text-sm uppercase tracking-wider mb-4">Selecionar Meses para Comparar</h2>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="flex-1 w-full">
            <label className="text-gray-400 text-xs uppercase tracking-wider mb-1 block">Mês Base</label>
            <select
              value={mesA}
              onChange={e => setMesA(e.target.value)}
              className="w-full bg-gray-800 border border-blue-700 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-blue-400"
            >
              {meses.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>

          <div className="flex items-center justify-center pt-4">
            <span className="text-gray-500 font-bold text-lg">vs</span>
          </div>

          <div className="flex-1 w-full">
            <label className="text-gray-400 text-xs uppercase tracking-wider mb-1 block">Mês Comparado</label>
            <select
              value={mesB}
              onChange={e => setMesB(e.target.value)}
              className="w-full bg-gray-800 border border-yellow-700 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-yellow-400"
            >
              {meses.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
        </div>

        {mesmomes && (
          <p className="text-yellow-500 text-xs mt-3 text-center">⚠ Você está comparando o mesmo mês consigo mesmo. Selecione meses diferentes.</p>
        )}
      </div>

      {/* Tabela comparativa */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-xs bg-gray-950">
              <th className="text-left px-5 py-4 text-gray-400 font-medium w-1/3">Métrica</th>
              <th className="text-right px-5 py-4 text-blue-400 font-semibold">{labelA}</th>
              <th className="text-right px-5 py-4 text-yellow-400 font-semibold">{labelB}</th>
              <th className="text-right px-5 py-4 text-gray-400 font-medium">Variação</th>
            </tr>
          </thead>
          <tbody>
            {metricas.map(grupo => (
              <>
                <tr key={grupo.grupo} className="bg-gray-800/50">
                  <td colSpan={4} className="px-5 py-2 text-gray-500 text-xs uppercase tracking-wider font-semibold">
                    {grupo.grupo}
                  </td>
                </tr>
                {grupo.itens.map(m => {
                  const vA = dadosA[m.campo];
                  const vB = dadosB[m.campo];
                  const pct = delta(vA, vB);
                  return (
                    <tr key={m.label} className="border-b border-gray-800 hover:bg-gray-800/40 transition-colors">
                      <td className="px-5 py-3.5 text-gray-300">{m.label}</td>
                      <td className="px-5 py-3.5 text-right">
                        <ValorCell valor={vA} formatar={m.fmt} />
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <ValorCell valor={vB} formatar={m.fmt} />
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <DeltaBadge pct={pct} invertido={m.invertido} />
                      </td>
                    </tr>
                  );
                })}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Resumo visual */}
      {!mesmomes && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Receita", delta: delta(dadosA.receita, dadosB.receita), a: dadosA.receita, b: dadosB.receita, fmt: fmtR, invertido: false },
            { label: "ROAS", delta: delta(dadosA.roas, dadosB.roas), a: dadosA.roas, b: dadosB.roas, fmt: fmtX, invertido: false },
            { label: "Leads Perdidos", delta: delta(dadosA.leads, dadosB.leads), a: dadosA.leads, b: dadosB.leads, fmt: fmtN, invertido: true },
          ].map(item => {
            const pct = item.delta;
            const positivo = item.invertido ? pct < 0 : pct > 0;
            const cor = pct == null || pct === 0 ? "border-gray-700" : positivo ? "border-green-500" : "border-red-500";
            const corTexto = pct == null || pct === 0 ? "text-gray-400" : positivo ? "text-green-400" : "text-red-400";
            return (
              <div key={item.label} className={`bg-gray-900 rounded-xl border-l-4 ${cor} p-5`}>
                <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">{item.label}</p>
                <div className="flex items-end justify-between gap-2">
                  <div>
                    <p className="text-gray-500 text-xs">{labelA}</p>
                    <p className="text-white font-semibold">{item.a != null ? item.fmt(item.a) : "—"}</p>
                  </div>
                  <div className="text-gray-600 text-lg font-light">→</div>
                  <div className="text-right">
                    <p className="text-gray-500 text-xs">{labelB}</p>
                    <p className="text-white font-semibold">{item.b != null ? item.fmt(item.b) : "—"}</p>
                  </div>
                </div>
                {pct != null && (
                  <p className={`mt-2 font-bold text-lg ${corTexto}`}>
                    {pct > 0 ? "▲" : pct < 0 ? "▼" : "→"} {Math.abs(pct).toFixed(1)}%
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}