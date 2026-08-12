import { useMemo, useState, useEffect } from "react";
import { useBrainSnapshot } from "@/components/brain/useBrainSnapshot";
import { buildDecisionKpis } from "@/lib/decisionKpis";
import DecisionSection from "@/components/decision/DecisionSection";
import { Loader2, LayoutDashboard, Pencil, Check, RotateCcw } from "lucide-react";

const STORE_KEY = "painel_decisao_hidden";

export default function PainelDecisao() {
  const { snapshot, loading, source } = useBrainSnapshot();
  const [editing, setEditing] = useState(false);
  const [hiddenIds, setHiddenIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || "[]"); } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem(STORE_KEY, JSON.stringify(hiddenIds));
  }, [hiddenIds]);

  const departments = useMemo(() => buildDecisionKpis(snapshot), [snapshot]);

  const toggle = (key) =>
    setHiddenIds((h) => (h.includes(key) ? h.filter((x) => x !== key) : [...h, key]));

  return (
    <div className="min-h-screen bg-gray-950 px-6 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-start justify-between gap-4 mb-6 pr-14">
          <div>
            <div className="flex items-center gap-2">
              <LayoutDashboard className="w-5 h-5 text-purple-400" />
              <h1 className="text-2xl font-bold text-white">Painel de Decisão</h1>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              KPIs por departamento comparados com os benchmarks do setor de locação
              {source?.name ? ` · base ${source.name}` : ""}
              {snapshot?.max_date ? ` · dados até ${snapshot.max_date}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {editing && hiddenIds.length > 0 && (
              <button
                onClick={() => setHiddenIds([])}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-900 border border-gray-800 text-gray-400 hover:text-white text-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Restaurar tudo
              </button>
            )}
            <button
              onClick={() => setEditing((e) => !e)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border transition-colors ${
                editing
                  ? "bg-purple-600 border-purple-500 text-white"
                  : "bg-gray-900 border-gray-800 text-gray-400 hover:text-white"
              }`}
            >
              {editing ? <><Check className="w-3.5 h-3.5" /> Concluir edição</> : <><Pencil className="w-3.5 h-3.5" /> Editar painel</>}
            </button>
          </div>
        </div>

        {editing && (
          <p className="text-xs text-purple-300/80 bg-purple-950/30 border border-purple-900/50 rounded-lg px-3 py-2 mb-6">
            Clique no ícone de olho em cada indicador para mostrar ou ocultar no seu painel.
          </p>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-gray-500 text-sm py-16">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando indicadores…
          </div>
        ) : !departments.length ? (
          <p className="text-gray-500 text-sm py-16">
            Nenhum dado disponível. Atualize os dados em Configuração de dados.
          </p>
        ) : (
          departments.map((d) => (
            <DecisionSection
              key={d.id}
              dept={d}
              editing={editing}
              hiddenIds={hiddenIds}
              onToggle={toggle}
            />
          ))
        )}
      </div>
    </div>
  );
}