import { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { fmtNum } from "@/lib/erpFormat";
import EstoqueFamiliaCard from "@/components/ativos/EstoqueFamiliaCard";
import QueryInspector from "@/components/erp/QueryInspector";
import { Layers, RefreshCw, AlertTriangle } from "lucide-react";

export default function EstoqueEstruturasPanel({ sourceId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("listEstoqueFamilia", {
        ...(sourceId ? { source_id: sourceId } : {}),
      });
      if (res.data?.error) setError(res.data.error);
      else setData(res.data);
    } catch (e) {
      setError("Não foi possível consultar o estoque agora. Detalhe: " + String(e?.message || e).slice(0, 200));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [sourceId]);

  const comSaldo = useMemo(
    () => (data?.itens || []).filter((i) => i.qt_saldo > 0).sort((a, b) => b.qt_saldo - a.qt_saldo),
    [data]
  );
  const andaimes = data?.familias?.find((f) => f.familia === "ANDAIMES");
  const escoramento = data?.familias?.find((f) => f.familia === "ESCORAMENTO");

  return (
    <div className="border border-gray-800 bg-gray-900/60 rounded-xl p-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-400" /> Estoque de andaimes × escoramento
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Saldo atual de peças por família (classificação do Cérebro), separando acesso em altura de sustentação de
            laje. Base: último movimento de estoque de cada item no ERP.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {data?.queries && <QueryInspector queries={data.queries} />}
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white text-sm rounded-lg px-3 py-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </button>
        </div>
      </div>

      {error && !data && (
        <div className="border border-red-700/50 bg-red-950/30 rounded-lg p-3 mt-4 text-sm text-red-300 flex gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {loading && !data && <div className="text-gray-500 text-center py-10">Levantando saldos de estoque…</div>}

      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            {andaimes && (
              <EstoqueFamiliaCard
                dados={andaimes}
                subtitle="Acesso e trabalho em altura"
                accent="border-emerald-700/50 bg-emerald-950/20"
                bar="bg-emerald-500"
              />
            )}
            {escoramento && (
              <EstoqueFamiliaCard
                dados={escoramento}
                subtitle="Sustentação de laje e formas"
                accent="border-amber-700/50 bg-amber-950/20"
                bar="bg-amber-500"
              />
            )}
          </div>

          <div className="mt-5">
            <div className="text-sm font-semibold text-white mb-2">
              Itens disponíveis hoje ({fmtNum(comSaldo.length)} com saldo)
            </div>
            <div className="overflow-auto max-h-96 rounded-lg border border-gray-800">
              <table className="w-full text-sm">
                <thead className="bg-gray-900 sticky top-0">
                  <tr className="text-left text-gray-400">
                    <th className="px-3 py-2 font-medium">Item</th>
                    <th className="px-3 py-2 font-medium">Grupo</th>
                    <th className="px-3 py-2 font-medium">Família</th>
                    <th className="px-3 py-2 font-medium text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {comSaldo.map((i) => (
                    <tr key={i.cd_equipto} className="border-t border-gray-800">
                      <td className="px-3 py-2 text-white">{i.nm_equipto}</td>
                      <td className="px-3 py-2 text-gray-400">{i.nm_grupo}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            i.familia === "ANDAIMES"
                              ? "bg-emerald-950/40 text-emerald-300"
                              : "bg-amber-950/40 text-amber-300"
                          }`}
                        >
                          {i.familia}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-white font-medium">
                        {fmtNum(Math.round(i.qt_saldo))}
                      </td>
                    </tr>
                  ))}
                  {comSaldo.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-gray-500">
                        Nenhum item com saldo no momento.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}