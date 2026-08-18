import { useMemo, useState } from "react";
import { Scale, AlertTriangle } from "lucide-react";
import { fmtCur as fmtBRL } from "@/lib/erpFormat";
import { analyzeItems, summarizeItems } from "@/lib/manutencaoVsDepreciacao";
import ManutencaoItemRow from "./ManutencaoItemRow";

const FILTROS = [
  { key: "queima", label: "Queima caixa" },
  { key: "atencao", label: "Sob atenção" },
  { key: "saudavel", label: "Saudável" },
  { key: "sem_valor", label: "Sem valor no ERP" },
  { key: "todos", label: "Todos com manutenção" },
];

export default function ManutencaoVsDepreciacao({ items = [] }) {
  const [filtro, setFiltro] = useState("queima");
  const [busca, setBusca] = useState("");

  const rows = useMemo(() => analyzeItems(items), [items]);
  const resumo = useMemo(() => summarizeItems(rows), [rows]);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return rows
      .filter((r) => (filtro === "todos" ? r.manutencao_12m > 0 : r.veredito === filtro))
      .filter((r) => !termo || `${r.nm_equipto} ${r.grupo}`.toLowerCase().includes(termo))
      .slice(0, 200);
  }, [rows, filtro, busca]);

  return (
    <div className="border border-gray-800 bg-gray-900/40 rounded-xl p-5">
      <h2 className="text-lg font-semibold text-white flex items-center gap-2">
        <Scale className="w-5 h-5 text-red-400" /> Manutenção x depreciação real por item
      </h2>
      <p className="text-sm text-gray-400 mt-1">
        Cada equipamento próprio comparando o que foi gasto em manutenção nos últimos 12 meses com a depreciação anual
        do valor imobilizado. Acima de 100% o item consome mais caixa do que devolve em valor.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
        <div className="border border-red-500/40 bg-red-950/20 rounded-lg p-3">
          <div className="text-xs text-red-300 uppercase">Itens queimando caixa</div>
          <div className="text-xl font-bold text-white mt-1">{resumo.queima_qtd}</div>
          <div className="text-xs text-gray-400">de {resumo.itens_com_manutencao} com manutenção no período</div>
        </div>
        <div className="border border-gray-800 rounded-lg p-3">
          <div className="text-xs text-gray-400 uppercase">Manutenção nesses itens</div>
          <div className="text-xl font-bold text-white mt-1">{fmtBRL(resumo.queima_manutencao)}</div>
          <div className="text-xs text-gray-400">de {fmtBRL(resumo.manutencao_total)} no total</div>
        </div>
        <div className="border border-gray-800 rounded-lg p-3">
          <div className="text-xs text-gray-400 uppercase">Excedente sobre a depreciação</div>
          <div className="text-xl font-bold text-red-300 mt-1">{fmtBRL(resumo.queima_excedente)}</div>
          <div className="text-xs text-gray-400">gasto anual além do desgaste do ativo</div>
        </div>
        <div className="border border-gray-800 rounded-lg p-3">
          <div className="text-xs text-gray-400 uppercase">Já depreciados e em manutenção</div>
          <div className="text-xl font-bold text-white mt-1">{resumo.zumbis_qtd}</div>
          <div className="text-xs text-gray-400">{fmtBRL(resumo.zumbis_manutencao)} gastos — candidatos a venda</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-5">
        {FILTROS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFiltro(f.key)}
            className={`text-xs rounded-lg px-3 py-1.5 border ${
              filtro === f.key
                ? "border-red-500/60 bg-red-950/30 text-red-200"
                : "border-gray-700 text-gray-400 hover:text-gray-200"
            }`}
          >
            {f.label}
          </button>
        ))}
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar equipamento ou grupo"
          className="ml-auto bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 placeholder:text-gray-600"
        />
      </div>

      <div className="overflow-x-auto mt-3">
        <table className="w-full text-sm min-w-[980px]">
          <thead>
            <tr className="text-xs text-gray-500 uppercase border-b border-gray-800">
              <th className="text-left py-2 pr-3">Item</th>
              <th className="text-right py-2 px-3">Valor imobilizado</th>
              <th className="text-right py-2 px-3">Idade média</th>
              <th className="text-right py-2 px-3">Depreciação/ano</th>
              <th className="text-right py-2 px-3">Manutenção 12m</th>
              <th className="text-right py-2 px-3">OS</th>
              <th className="text-right py-2 px-3">Manut./Depr.</th>
              <th className="text-right py-2 px-3">Excedente</th>
              <th className="text-right py-2 pl-3">Veredito</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((r) => <ManutencaoItemRow key={r.cd_equipto} row={r} />)}
          </tbody>
        </table>
        {visiveis.length === 0 && (
          <div className="text-center text-gray-500 py-8 text-sm">Nenhum item neste filtro.</div>
        )}
      </div>

      <div className="mt-3 text-xs text-gray-500 flex gap-2">
        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" />
        Depreciação linear pela vida útil de referência do mercado de locação (plataformas 10 anos, estruturas 20,
        equipamentos leves 5 a 7). Itens sem valor de aquisição no ERP aparecem separados porque a depreciação não pode
        ser apurada.
      </div>
    </div>
  );
}