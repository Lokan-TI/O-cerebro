import { Fragment, useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useErpSource } from "@/lib/ErpSourceContext";
import { X, ChevronDown, ChevronUp } from "lucide-react";
import { formatDateTime, formatDuration } from "@/lib/erpSync";

const STATUS_MAP = {
  success: { label: "Concluída", color: "text-green-400 bg-green-950" },
  partial: { label: "Com ressalvas", color: "text-yellow-400 bg-yellow-950" },
  failed: { label: "Falha", color: "text-red-400 bg-red-950" },
  running: { label: "Em processamento", color: "text-blue-400 bg-blue-950" },
  pending: { label: "Aguardando", color: "text-gray-400 bg-gray-800" },
  cancelled: { label: "Cancelada", color: "text-gray-500 bg-gray-800" },
};

export default function SyncHistoryPanel({ open, onClose }) {
  const { selectedSource } = useErpSource();
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    base44.entities.ErpSyncRun.filter(
      selectedSource?.id ? { source_id: selectedSource.id } : {},
      "-started_at",
      50
    ).then(list => setRuns(list || [])).catch(() => setRuns([])).finally(() => setLoading(false));
  }, [open, selectedSource?.id]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-white font-bold text-lg">
            Histórico de atualizações{selectedSource ? ` — ${selectedSource.name}` : ""}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="overflow-auto flex-1">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Carregando...</div>
          ) : runs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">Nenhuma atualização registrada.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-800 border-b border-gray-700 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase">Início</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase">Conclusão</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase">Usuário</th>
                  <th className="text-right px-4 py-3 text-gray-400 font-medium text-xs uppercase">Duração</th>
                  <th className="text-right px-4 py-3 text-gray-400 font-medium text-xs uppercase">Registros</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase">Versão</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {runs.map(run => {
                  const st = STATUS_MAP[run.status] || STATUS_MAP.pending;
                  const isExp = expanded === run.id;
                  return (
                    <Fragment key={run.id}>
                      <tr className="border-b border-gray-800 hover:bg-gray-800/40 cursor-pointer" onClick={() => setExpanded(isExp ? null : run.id)}>
                        <td className="px-4 py-3 text-gray-300">{formatDateTime(run.started_at)}</td>
                        <td className="px-4 py-3 text-gray-400">{formatDateTime(run.completed_at)}</td>
                        <td className="px-4 py-3 text-gray-400">{run.started_by_name || "—"}</td>
                        <td className="px-4 py-3 text-right text-gray-400">{formatDuration(run.duration_ms)}</td>
                        <td className="px-4 py-3 text-right text-gray-400">{(run.records_valid || 0).toLocaleString("pt-BR")}</td>
                        <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs ${st.color}`}>{st.label}</span></td>
                        <td className="px-4 py-3 text-gray-500 font-mono text-xs">{run.version || "—"}</td>
                        <td className="px-4 py-3 text-gray-600">{isExp ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</td>
                      </tr>
                      {isExp && (
                        <tr className="bg-gray-950">
                          <td colSpan={8} className="px-6 py-4">
                            <div className="space-y-1 text-xs">
                              {run.error_message && <p className="text-red-400">Erro: {run.error_message}</p>}
                              {run.warning_count > 0 && <p className="text-yellow-400">Avisos ({run.warning_count}): {(run.warnings || []).join("; ")}</p>}
                              <p className="text-gray-500">Etapa final: {run.step_label || "—"}</p>
                              <p className="text-gray-500">Versão anterior: {run.previous_version || "—"}</p>
                              <p className="text-gray-500">Data máxima: {run.max_date || "—"}</p>
                              <p className="text-gray-500">Consultas executadas: {run.records_extracted || 0}</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}