import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useErpSource, ALL_SOURCES_ID } from "@/lib/ErpSourceContext";
import { fmtNum } from "@/lib/erpFormat";
import { X, Package, History, Boxes } from "lucide-react";

export default function ClientePatrimoniosModal({ client, onClose }) {
  const { selectedSource } = useErpSource();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState("current");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = { cd_pessoa: Number(client.cd_pessoa) };
        if (selectedSource?.id && selectedSource.id !== ALL_SOURCES_ID) payload.source_id = selectedSource.id;
        const res = await base44.functions.invoke("listClientePatrimonios", payload);
        if (alive) setData(res.data);
      } catch (e) {
        if (alive) setError(e?.response?.data?.error || e.message || "Falha ao carregar patrimônios");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [client.cd_pessoa, selectedSource]);

  const t = data?.totals || {};

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-5xl my-8">
        <div className="flex items-start justify-between p-5 border-b border-gray-800">
          <div>
            <h3 className="text-white font-semibold flex items-center gap-2">
              <Package className="w-4 h-4 text-purple-400" /> Patrimônios do cliente
            </h3>
            <div className="text-sm text-gray-400 mt-1">{client.nm_pessoa} <span className="text-gray-600">· #{client.cd_pessoa}</span></div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          {loading && <div className="text-gray-500 py-8 text-center">Consultando patrimônios no ERP…</div>}
          {error && <div className="bg-red-950/40 border border-red-800/50 rounded-lg px-4 py-2 text-red-300 text-sm">{error}</div>}

          {data && !loading && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-gray-950 border border-gray-800 rounded-lg p-3">
                  <div className="text-xs text-gray-500 uppercase">Em posse hoje</div>
                  <div className="text-xl font-bold text-amber-400">{fmtNum(t.patrimonios_em_posse || 0)}</div>
                </div>
                <div className="bg-gray-950 border border-gray-800 rounded-lg p-3">
                  <div className="text-xs text-gray-500 uppercase">Patrimônios no histórico</div>
                  <div className="text-xl font-bold text-white">{fmtNum(t.patrimonios_historico || 0)}</div>
                </div>
                <div className="bg-gray-950 border border-gray-800 rounded-lg p-3">
                  <div className="text-xs text-gray-500 uppercase">Locações registradas</div>
                  <div className="text-xl font-bold text-white">{fmtNum(t.locacoes || 0)}</div>
                </div>
                <div className="bg-gray-950 border border-gray-800 rounded-lg p-3">
                  <div className="text-xs text-gray-500 uppercase">Dias de equipamento</div>
                  <div className="text-xl font-bold text-purple-400">{fmtNum(t.dias_total || 0)}</div>
                </div>
              </div>

              <div className="flex gap-1 bg-gray-950 border border-gray-800 rounded-lg p-1 w-fit">
                <button
                  onClick={() => setView("current")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium ${view === "current" ? "bg-purple-600 text-white" : "text-gray-400 hover:text-gray-200"}`}
                >
                  <Boxes className="w-3.5 h-3.5" /> Em posse do cliente
                </button>
                <button
                  onClick={() => setView("history")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium ${view === "history" ? "bg-purple-600 text-white" : "text-gray-400 hover:text-gray-200"}`}
                >
                  <History className="w-3.5 h-3.5" /> Histórico completo
                </button>
              </div>

              <div className="border border-gray-800 rounded-lg overflow-x-auto max-h-[420px] overflow-y-auto">
                {view === "current" ? (
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-gray-900">
                      <tr className="text-gray-500 text-xs uppercase border-b border-gray-800">
                        <th className="text-left py-2 px-3">Patrimônio</th>
                        <th className="text-left py-2 px-3">Produto</th>
                        <th className="text-left py-2 px-3">Contrato</th>
                        <th className="text-right py-2 px-3">Saída</th>
                        <th className="text-right py-2 px-3">Dias em posse</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.current.map((r, i) => (
                        <tr key={`${r.cd_patrimonio}-${r.cd_flremessa}-${i}`} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                          <td className="py-2 px-3 text-white font-mono text-xs">{r.nr_patrimonio}</td>
                          <td className="py-2 px-3 text-gray-300">{r.nm_equipto || "—"}</td>
                          <td className="py-2 px-3 text-gray-500 text-xs">{r.nr_contrato || r.cd_flremessa}</td>
                          <td className="py-2 px-3 text-right text-gray-400 text-xs">{r.dt_saida || "—"}</td>
                          <td className="py-2 px-3 text-right text-amber-400">{fmtNum(r.dias)}</td>
                        </tr>
                      ))}
                      {data.current.length === 0 && (
                        <tr><td colSpan={5} className="text-center text-gray-600 py-6">Nenhum patrimônio em posse deste cliente</td></tr>
                      )}
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-gray-900">
                      <tr className="text-gray-500 text-xs uppercase border-b border-gray-800">
                        <th className="text-left py-2 px-3">Patrimônio</th>
                        <th className="text-left py-2 px-3">Produto</th>
                        <th className="text-right py-2 px-3">Locações</th>
                        <th className="text-right py-2 px-3">Dias totais</th>
                        <th className="text-right py-2 px-3">1ª saída</th>
                        <th className="text-right py-2 px-3">Última saída</th>
                        <th className="text-right py-2 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.history.map((r) => (
                        <tr key={r.cd_patrimonio} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                          <td className="py-2 px-3 text-white font-mono text-xs">{r.nr_patrimonio}</td>
                          <td className="py-2 px-3 text-gray-300">{r.nm_equipto || "—"}</td>
                          <td className="py-2 px-3 text-right text-gray-300">{fmtNum(r.qtd_locacoes)}</td>
                          <td className="py-2 px-3 text-right text-purple-400">{fmtNum(r.dias_total)}</td>
                          <td className="py-2 px-3 text-right text-gray-500 text-xs">{r.primeira_saida || "—"}</td>
                          <td className="py-2 px-3 text-right text-gray-500 text-xs">{r.ultima_saida || "—"}</td>
                          <td className="py-2 px-3 text-right text-xs">
                            {r.em_posse ? <span className="text-amber-400">Em posse</span> : <span className="text-gray-600">Devolvido</span>}
                          </td>
                        </tr>
                      ))}
                      {data.history.length === 0 && (
                        <tr><td colSpan={7} className="text-center text-gray-600 py-6">Nenhuma locação de patrimônio encontrada</td></tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}