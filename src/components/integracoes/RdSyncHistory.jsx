const LBL = { marketing: "RD Marketing", crm: "RD CRM", conversas: "RD Conversas", erp_match: "Vínculo ERP" };
const ST = { running: "text-amber-400", done: "text-emerald-400", error: "text-red-400" };
const fmt = (d) => (d ? new Date(d).toLocaleString("pt-BR") : "—");

export default function RdSyncHistory({ runs }) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-5">
      <p className="text-sm font-semibold text-white mb-3">Histórico de sincronizações</p>
      {runs.length === 0 ? <p className="text-xs text-gray-500">Nenhuma sincronização executada ainda.</p> : (
        <div className="overflow-x-auto max-h-80">
          <table className="text-xs text-gray-300">
            <thead><tr><th className="text-left">Produto</th><th className="text-left">Início</th><th className="text-left">Fim</th><th className="text-left">Estado</th><th className="text-right">Páginas</th><th className="text-right">Registros</th><th className="text-left">Erro</th><th className="text-left">Por</th></tr></thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id}>
                  <td>{LBL[r.product] || r.product}</td><td>{fmt(r.started_at)}</td><td>{fmt(r.finished_at)}</td>
                  <td className={ST[r.status]}>{{ running: "Em andamento", done: "Concluída", error: "Erro" }[r.status]}</td>
                  <td className="text-right">{r.pages || 0}</td><td className="text-right">{(r.records || 0).toLocaleString("pt-BR")}</td>
                  <td className="text-red-400/80 max-w-xs truncate" title={r.last_error}>{r.last_error || ""}</td><td className="text-gray-500">{r.performed_by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}