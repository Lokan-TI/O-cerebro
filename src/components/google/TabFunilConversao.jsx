import { useState, useMemo } from "react";
import { CLIENTES_WON, FUNIL, RESUMO } from "@/components/google/googleData.jsx";
import { TrendingDown, TrendingUp, Users, ChevronRight } from "lucide-react";

// Dados simulados de pipeline baseados no cohort Google
// Leads = cohort total, Qualificados = Won + Lost (avançaram), Proposta = Won + pct Lost, Fechado = Won
const VENDEDORES = [...new Set(CLIENTES_WON.map(c => c.resp))].sort();
const PRODUTOS = [...new Set(CLIENTES_WON.map(c => {
  // Simplifica produto para categoria
  if (c.produto.startsWith("T")) return "Tubular";
  if (c.produto.includes("D")) return "Diâmetro";
  if (c.produto.includes("E")) return "Especial";
  return "Outros";
}))].sort();

function calcFunil(vendedor, produto) {
  // Filtra clientes won
  let won = CLIENTES_WON;
  if (vendedor !== "todos") won = won.filter(c => c.resp === vendedor);
  if (produto !== "todos") {
    won = won.filter(c => {
      if (produto === "Tubular") return c.produto.startsWith("T");
      if (produto === "Diâmetro") return c.produto.includes("D") && !c.produto.startsWith("T");
      if (produto === "Especial") return c.produto.includes("E") && !c.produto.startsWith("T");
      return true;
    });
  }

  const totalWon = won.length;
  // Proporções baseadas nos dados reais do cohort
  // Won = 66 de 442 total, Lost = 93, Open = 283
  // Escalamos pelo filtro
  const ratio = totalWon / RESUMO.clientes_won;

  const leads = Math.round(RESUMO.cohort_total * ratio);
  const qualificados = Math.round((RESUMO.clientes_won + 93) * ratio); // won + lost
  const proposta = Math.round(qualificados * 0.72); // ~72% dos que avançaram receberam proposta
  const fechado = totalWon;

  return { leads, qualificados, proposta, fechado };
}

const ETAPAS = [
  { key: "leads",        label: "Leads",        color: "#3b82f6", light: "rgba(59,130,246,0.15)", border: "border-blue-500" },
  { key: "qualificados", label: "Qualificados",  color: "#8b5cf6", light: "rgba(139,92,246,0.15)", border: "border-purple-500" },
  { key: "proposta",     label: "Proposta",      color: "#f59e0b", light: "rgba(245,158,11,0.15)",  border: "border-yellow-500" },
  { key: "fechado",      label: "Fechado",       color: "#22c55e", light: "rgba(34,197,94,0.15)",   border: "border-green-500" },
];

function pct(a, b) {
  if (!b || b === 0) return "—";
  return ((a / b) * 100).toFixed(1) + "%";
}

export default function TabFunilConversao() {
  const [vendedor, setVendedor] = useState("todos");
  const [produto, setProduto] = useState("todos");
  const [hoveredStep, setHoveredStep] = useState(null);

  const funil = useMemo(() => calcFunil(vendedor, produto), [vendedor, produto]);

  const valores = [funil.leads, funil.qualificados, funil.proposta, funil.fechado];
  const maxVal = valores[0] || 1;

  const conversoes = [
    { de: "Leads", para: "Qualificados", taxa: pct(funil.qualificados, funil.leads), perdidos: funil.leads - funil.qualificados },
    { de: "Qualificados", para: "Proposta",     taxa: pct(funil.proposta, funil.qualificados), perdidos: funil.qualificados - funil.proposta },
    { de: "Proposta",     para: "Fechado",       taxa: pct(funil.fechado, funil.proposta), perdidos: funil.proposta - funil.fechado },
  ];

  const taxaGeral = pct(funil.fechado, funil.leads);

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-xs uppercase tracking-wider">Vendedor</span>
          <select
            value={vendedor}
            onChange={e => setVendedor(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500"
          >
            <option value="todos">Todos</option>
            {VENDEDORES.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-xs uppercase tracking-wider">Categoria</span>
          <select
            value={produto}
            onChange={e => setProduto(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500"
          >
            <option value="todos">Todos</option>
            {PRODUTOS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="ml-auto flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-4 py-1.5">
          <span className="text-gray-400 text-xs">Conversão geral (Lead → Fechado)</span>
          <span className="text-green-400 font-bold text-sm">{taxaGeral}</span>
        </div>
      </div>

      {/* Funil visual */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h2 className="text-white font-semibold text-sm uppercase tracking-wider mb-6">
          Funil de Conversão — Google First-Touch
        </h2>

        <div className="space-y-3">
          {ETAPAS.map((etapa, i) => {
            const val = valores[i];
            const largura = (val / maxVal) * 100;
            const isHovered = hoveredStep === i;

            return (
              <div key={etapa.key}>
                {/* Barra da etapa */}
                <div
                  className="relative cursor-pointer"
                  onMouseEnter={() => setHoveredStep(i)}
                  onMouseLeave={() => setHoveredStep(null)}
                >
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-gray-400 text-xs w-24 text-right shrink-0">{etapa.label}</span>
                    <div className="flex-1 relative h-10 bg-gray-800 rounded-lg overflow-hidden">
                      <div
                        className="h-full rounded-lg flex items-center justify-end pr-3 transition-all duration-500"
                        style={{
                          width: `${largura}%`,
                          background: isHovered
                            ? etapa.color
                            : `linear-gradient(90deg, ${etapa.color}99, ${etapa.color})`,
                          minWidth: val > 0 ? "60px" : "0",
                        }}
                      >
                        <span className="text-white font-bold text-sm">{val}</span>
                      </div>
                    </div>
                    <span className="text-gray-500 text-xs w-12 shrink-0">
                      {((val / maxVal) * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                {/* Seta de conversão entre etapas */}
                {i < ETAPAS.length - 1 && (
                  <div className="flex items-center gap-3 my-1">
                    <div className="w-24 shrink-0" />
                    <div className="flex-1 flex items-center gap-2 pl-2">
                      <ChevronRight className="w-4 h-4 text-gray-600 shrink-0" />
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-gray-600">conversão</span>
                        <span
                          className="font-semibold"
                          style={{ color: parseFloat(conversoes[i].taxa) >= 50 ? "#22c55e" : parseFloat(conversoes[i].taxa) >= 25 ? "#f59e0b" : "#ef4444" }}
                        >
                          {conversoes[i].taxa}
                        </span>
                        <span className="text-gray-700">·</span>
                        <span className="text-gray-600">{conversoes[i].perdidos} perdidos nesta etapa</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Cards de conversão entre etapas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {conversoes.map((c, i) => {
          const taxa = parseFloat(c.taxa);
          const bom = taxa >= (i === 2 ? 20 : 50);
          return (
            <div key={i} className={`bg-gray-900 rounded-xl border p-5 ${bom ? "border-green-800" : "border-red-900"}`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-400 text-xs uppercase tracking-wider">{c.de} → {c.para}</span>
                {bom
                  ? <TrendingUp className="w-4 h-4 text-green-500" />
                  : <TrendingDown className="w-4 h-4 text-red-500" />
                }
              </div>
              <p className={`text-3xl font-bold ${bom ? "text-green-400" : "text-red-400"}`}>{c.taxa}</p>
              <p className="text-gray-600 text-xs mt-1">{c.perdidos} leads perdidos nesta transição</p>
            </div>
          );
        })}
      </div>

      {/* Tabela por vendedor */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="p-4 border-b border-gray-800">
          <h3 className="text-white font-semibold text-sm uppercase tracking-wider">Performance por Vendedor — Clientes Fechados</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs">
                <th className="text-left px-5 py-3 text-gray-400">Vendedor</th>
                <th className="text-right px-5 py-3 text-gray-400">Fechados</th>
                <th className="text-right px-5 py-3 text-gray-400">Com Recompra</th>
                <th className="text-right px-5 py-3 text-gray-400">Taxa Recompra</th>
                <th className="text-right px-5 py-3 text-gray-400">Receita Total</th>
              </tr>
            </thead>
            <tbody>
              {VENDEDORES.map(v => {
                const clientes = CLIENTES_WON.filter(c => c.resp === v);
                const comRecompra = clientes.filter(c => c.fechados_pos > 0).length;
                const receita = clientes.reduce((s, c) => s + c.receita_total, 0);
                const taxaRecompra = clientes.length > 0 ? ((comRecompra / clientes.length) * 100).toFixed(0) + "%" : "—";
                return (
                  <tr key={v} className="border-b border-gray-800 hover:bg-gray-800 transition-colors">
                    <td className="px-5 py-3 text-gray-200 font-medium">{v}</td>
                    <td className="px-5 py-3 text-right text-white">{clientes.length}</td>
                    <td className="px-5 py-3 text-right text-purple-400">{comRecompra}</td>
                    <td className="px-5 py-3 text-right">
                      <span className={`font-semibold ${parseInt(taxaRecompra) >= 20 ? "text-green-400" : "text-gray-400"}`}>
                        {taxaRecompra}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-blue-400 font-semibold">
                      R$ {receita.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
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