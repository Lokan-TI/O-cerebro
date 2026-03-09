import { useState, useMemo } from "react";
import { RESUMO, RETIDO_POR_MES, DISTRIB_RECOMPRA, RECOMPRAS, CLIENTES_WON, getCategoriaFromProduto } from "@/components/google/googleData.jsx";
import { isInRange, DATE_RANGE_DEFAULT } from "@/components/google/DateRangeFilter.jsx";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, CartesianGrid, Legend,
} from "recharts";

const fmtR = (v) => "R$ " + (v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtR2 = (v) => "R$ " + (v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const BAR_COLORS = ["#3b82f6", "#6b7280", "#a855f7", "#f59e0b", "#22c55e"];

function MesRetencaoTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="bg-gray-900 border border-yellow-700 rounded-xl p-4 shadow-2xl min-w-[190px]">
      <p className="text-yellow-400 font-bold text-sm mb-2">{label}</p>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Receita Retida</span>
          <span className="text-yellow-400 font-semibold">{fmtR(d?.receita_retida)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Clientes</span>
          <span className="text-white">{d?.clientes}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Vendas</span>
          <span className="text-white">{d?.vendas}</span>
        </div>
        <div className="border-t border-gray-700 pt-1 flex justify-between gap-4">
          <span className="text-gray-400">Acumulado</span>
          <span className="text-blue-400 font-semibold">{fmtR(d?.acumulado)}</span>
        </div>
      </div>
    </div>
  );
}

function DistribTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 shadow-xl">
      <p className="text-white font-semibold text-sm">{label}</p>
      <p className="text-gray-300 text-xs mt-1">{d?.clientes} clientes</p>
      <p className="text-gray-400 text-xs">{d?.pct}% dos WON</p>
    </div>
  );
}

export default function TabGoogleRetencao({ categoria = "Todos", dateRange = DATE_RANGE_DEFAULT }) {
  const [selectedMes, setSelectedMes] = useState(null);
  const [activeDistrib, setActiveDistrib] = useState(null);

  // Clientes WON filtrados por categoria
  const clientesFiltrados = useMemo(() =>
    categoria === "Todos"
      ? CLIENTES_WON
      : CLIENTES_WON.filter(c => getCategoriaFromProduto(c.produto) === categoria),
    [categoria]
  );

  // Recompras filtradas por categoria E por data
  const clientesWonNomes = useMemo(() => new Set(clientesFiltrados.map(c => c.cliente)), [clientesFiltrados]);
  const recomprasFiltradas = useMemo(() => {
    let data = categoria === "Todos" ? RECOMPRAS : RECOMPRAS.filter(r => clientesWonNomes.has(r.cliente));
    return data.filter(r => isInRange(r.data, dateRange));
  }, [categoria, clientesWonNomes, dateRange]);

  // Receita retida por mês filtrada
  const retidoPorMesFiltrado = useMemo(() => {
    if (categoria === "Todos") return RETIDO_POR_MES;
    const byMes = {};
    recomprasFiltradas.forEach(r => {
      const mes = r.data.substring(0, 7);
      if (!byMes[mes]) byMes[mes] = { mes, receita_retida: 0, clientes: new Set(), vendas: 0 };
      byMes[mes].receita_retida += r.valor;
      byMes[mes].clientes.add(r.cliente);
      byMes[mes].vendas += 1;
    });
    let acumulado = 0;
    return Object.values(byMes)
      .sort((a, b) => a.mes.localeCompare(b.mes))
      .map(d => {
        acumulado += d.receita_retida;
        return { ...d, clientes: d.clientes.size, acumulado };
      });
  }, [categoria, recomprasFiltradas]);

  // Distribuição de recompras filtrada
  const distribData = useMemo(() => {
    if (categoria === "Todos") {
      return DISTRIB_RECOMPRA.map(d => ({
        name: d.fechados_pos === 0 ? "0 recompras" : `${d.fechados_pos} recompra${d.fechados_pos > 1 ? "s" : ""}`,
        clientes: d.clientes, pct: (d.pct * 100).toFixed(1), fechados_pos: d.fechados_pos,
      }));
    }
    const counts = {};
    clientesFiltrados.forEach(c => {
      counts[c.fechados_pos] = (counts[c.fechados_pos] || 0) + 1;
    });
    const total = clientesFiltrados.length || 1;
    return Object.entries(counts)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([fp, cnt]) => ({
        name: Number(fp) === 0 ? "0 recompras" : `${fp} recompra${Number(fp) > 1 ? "s" : ""}`,
        clientes: cnt,
        pct: ((cnt / total) * 100).toFixed(1),
        fechados_pos: Number(fp),
      }));
  }, [categoria, clientesFiltrados]);

  // KPIs derivados
  const totalRetido = recomprasFiltradas.reduce((s, r) => s + r.valor, 0);
  const totalReceita = clientesFiltrados.reduce((s, c) => s + c.receita_total, 0);
  const shareRetido = totalReceita > 0 ? totalRetido / totalReceita : 0;
  const comRecompra = clientesFiltrados.filter(c => c.fechados_pos > 0).length;
  const totalNegocios = clientesFiltrados.reduce((s, c) => s + c.fechados_total, 0);

  const mesDado = retidoPorMesFiltrado.find(d => d.mes === selectedMes);
  const recomprasMes = selectedMes
    ? recomprasFiltradas.filter(r => r.data.startsWith(selectedMes))
    : [];

  return (
    <div className="space-y-6">
      {/* Badge de filtro ativo */}
      {categoria !== "Todos" && (
        <div className="bg-blue-950/40 border border-blue-800 rounded-lg px-4 py-2 text-xs text-blue-300">
          Exibindo apenas produtos da categoria <strong>{categoria}</strong> · {clientesFiltrados.length} clientes WON filtrados
        </div>
      )}

      {/* KPIs retenção */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-900 border-l-4 border-yellow-500 rounded-lg p-5">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">$$ Retido Total</p>
          <p className="text-2xl font-bold text-white">{fmtR(totalRetido)}</p>
          <p className="text-gray-500 text-xs mt-1">receita após 1º fechamento</p>
        </div>
        <div className="bg-gray-900 border-l-4 border-purple-500 rounded-lg p-5">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Share de Retenção</p>
          <p className="text-3xl font-bold text-white">{(shareRetido * 100).toFixed(1)}%</p>
          <p className="text-gray-500 text-xs mt-1">da receita fechado total</p>
        </div>
        <div className="bg-gray-900 border-l-4 border-blue-500 rounded-lg p-5">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Negócios de Recompra</p>
          <p className="text-3xl font-bold text-white">{recomprasFiltradas.length}</p>
          <p className="text-gray-500 text-xs mt-1">de {totalNegocios} negócios totais</p>
        </div>
        <div className="bg-gray-900 border-l-4 border-green-500 rounded-lg p-5">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Clientes com Recompra</p>
          <p className="text-3xl font-bold text-white">{comRecompra}</p>
          <p className="text-gray-500 text-xs mt-1">{clientesFiltrados.length > 0 ? ((comRecompra / clientesFiltrados.length) * 100).toFixed(1) : 0}% dos WON</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribuição interativa */}
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <h2 className="text-white font-semibold mb-1 text-sm uppercase tracking-wider">Distribuição de Recompras entre Clientes WON</h2>
          <p className="text-gray-600 text-xs mb-4">Passe o mouse para detalhar</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={distribData} onMouseLeave={() => setActiveDistrib(null)}>
              <XAxis dataKey="name" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<DistribTooltip />} cursor={{ fill: "rgba(168,85,247,0.08)" }} />
              <Bar dataKey="clientes" radius={[4, 4, 0, 0]} cursor="pointer" onMouseEnter={(_, i) => setActiveDistrib(i)}>
                {distribData.map((_, i) => (
                  <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} opacity={activeDistrib === null || activeDistrib === i ? 1 : 0.35} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {activeDistrib !== null && distribData[activeDistrib] && (
            <div className="mt-3 bg-gray-800 rounded-lg p-3 text-sm text-center">
              <span className="text-white font-semibold">{distribData[activeDistrib].name}</span>
              <span className="text-gray-400 mx-2">·</span>
              <span className="text-white">{distribData[activeDistrib].clientes} clientes</span>
              <span className="text-gray-400 mx-2">·</span>
              <span className="text-yellow-400">{distribData[activeDistrib].pct}% dos WON</span>
            </div>
          )}
        </div>

        {/* Receita retida por mês — interativo */}
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-white font-semibold text-sm uppercase tracking-wider">Receita Retida por Mês</h2>
            {selectedMes && (
              <button onClick={() => setSelectedMes(null)} className="text-xs text-gray-400 hover:text-white bg-gray-800 px-2 py-1 rounded transition-colors">
                ✕ {selectedMes}
              </button>
            )}
          </div>
          <p className="text-gray-600 text-xs mb-4">Clique em um mês para ver as recompras</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={retidoPorMesFiltrado}
              onClick={(e) => e?.activeLabel && setSelectedMes(prev => prev === e.activeLabel ? null : e.activeLabel)}
            >
              <XAxis
                dataKey="mes"
                tick={({ x, y, payload }) => (
                  <text x={x} y={y + 12} textAnchor="middle"
                    fill={payload.value === selectedMes ? "#fbbf24" : "#6b7280"}
                    fontSize={11} fontWeight={payload.value === selectedMes ? "bold" : "normal"}>
                    {payload.value}
                  </text>
                )}
                axisLine={false} tickLine={false}
              />
              <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<MesRetencaoTooltip />} cursor={{ fill: "rgba(245,158,11,0.08)" }} />
              <Bar dataKey="receita_retida" radius={[4, 4, 0, 0]} name="Receita Retida" cursor="pointer">
                {RETIDO_POR_MES.map((d) => (
                  <Cell key={d.mes} fill={d.mes === selectedMes ? "#fcd34d" : "#f59e0b"} opacity={selectedMes && d.mes !== selectedMes ? 0.35 : 1} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Painel de detalhe do mês selecionado */}
      {selectedMes && mesDado && (
        <div className="bg-gray-800 border border-yellow-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h3 className="text-yellow-400 font-bold text-sm uppercase tracking-wider">Detalhe — {selectedMes}</h3>
            <div className="flex gap-4 text-xs text-gray-400 flex-wrap">
              <span>Receita retida: <strong className="text-yellow-400">{fmtR(mesDado.receita_retida)}</strong></span>
              <span>Clientes: <strong className="text-white">{mesDado.clientes}</strong></span>
              <span>Vendas: <strong className="text-white">{mesDado.vendas}</strong></span>
              <span>Acumulado: <strong className="text-blue-400">{fmtR(mesDado.acumulado)}</strong></span>
            </div>
          </div>
          {recomprasMes.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-700">
                    <th className="text-left py-2 pr-4">Cliente</th>
                    <th className="text-left py-2 pr-4">Produto</th>
                    <th className="text-left py-2 pr-4">Local</th>
                    <th className="text-left py-2 pr-4">Resp.</th>
                    <th className="text-right py-2">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {recomprasMes.map((r, i) => (
                    <tr key={i} className="border-b border-gray-700 hover:bg-gray-700 transition-colors">
                      <td className="py-2 pr-4 text-gray-200 font-medium">{r.cliente}</td>
                      <td className="py-2 pr-4 text-gray-400">{r.produto}</td>
                      <td className="py-2 pr-4 text-gray-400">{r.local}</td>
                      <td className="py-2 pr-4 text-gray-400">{r.resp}</td>
                      <td className="py-2 text-right text-yellow-400 font-semibold">{fmtR2(r.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-600 text-sm text-center py-4">Sem recompras registradas neste mês.</p>
          )}
        </div>
      )}

      {/* Acumulado */}
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
        <h2 className="text-white font-semibold mb-1 text-sm uppercase tracking-wider">Receita Retida Acumulada ao Longo do Tempo</h2>
        <p className="text-gray-600 text-xs mb-4">Passe o mouse sobre os pontos para ver valores</p>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={retidoPorMesFiltrado}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="mes" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8, fontSize: 12 }}
              formatter={(v, name) => [fmtR(v), name]}
              labelStyle={{ color: "#9ca3af", marginBottom: 4 }}
            />
            <Line type="monotone" dataKey="acumulado" stroke="#f59e0b" strokeWidth={2.5}
              dot={{ fill: "#f59e0b", r: 5, strokeWidth: 0 }}
              activeDot={{ r: 8, fill: "#fbbf24", stroke: "#fff", strokeWidth: 2 }}
              name="Acumulado" />
            <Line type="monotone" dataKey="receita_retida" stroke="#3b82f6" strokeWidth={2}
              dot={{ fill: "#3b82f6", r: 4, strokeWidth: 0 }}
              activeDot={{ r: 7, fill: "#60a5fa", stroke: "#fff", strokeWidth: 2 }}
              strokeDasharray="4 2" name="Mensal" />
            <Legend formatter={(v) => <span style={{ color: "#d1d5db", fontSize: 11 }}>{v}</span>} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Tabela mensal */}
      <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
        <div className="p-4 border-b border-gray-800">
          <h2 className="text-white font-semibold text-sm uppercase tracking-wider">Detalhe Mensal — Retenção</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-xs">
              <th className="text-left px-5 py-3 text-gray-400 font-medium">Mês</th>
              <th className="text-right px-5 py-3 text-gray-400 font-medium">Receita Retida</th>
              <th className="text-right px-5 py-3 text-gray-400 font-medium">Clientes</th>
              <th className="text-right px-5 py-3 text-gray-400 font-medium">Vendas</th>
              <th className="text-right px-5 py-3 text-gray-400 font-medium">Acumulado</th>
            </tr>
          </thead>
          <tbody>
            {retidoPorMesFiltrado.map((m) => (
              <tr
                key={m.mes}
                onClick={() => setSelectedMes(prev => prev === m.mes ? null : m.mes)}
                className={`border-b border-gray-800 cursor-pointer transition-colors ${
                  selectedMes === m.mes ? "bg-yellow-900/20 border-yellow-800" : "hover:bg-gray-800"
                }`}
              >
                <td className={`px-5 py-3 font-medium ${selectedMes === m.mes ? "text-yellow-400" : "text-gray-300"}`}>{m.mes}</td>
                <td className="px-5 py-3 text-right text-yellow-400 font-semibold">{fmtR(m.receita_retida)}</td>
                <td className="px-5 py-3 text-right text-gray-300">{m.clientes}</td>
                <td className="px-5 py-3 text-right text-gray-300">{m.vendas}</td>
                <td className="px-5 py-3 text-right text-blue-400">{fmtR(m.acumulado)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}