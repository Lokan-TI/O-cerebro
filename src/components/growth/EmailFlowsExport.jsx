import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { downloadEmailFlowsWorkbook } from "./emailFlowsWorkbook";
import { Button } from "@/components/ui/button";
import { Download, Loader2, RefreshCw } from "lucide-react";

export default function EmailFlowsExport() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [progress, setProgress] = useState(null);

  const load = async () => {
    setLoading(true); setError(null); setProgress(null);
    try {
      const rows = [];
      let meta = null;
      let offset = 0;
      // A base completa não cabe numa única resposta, então buscamos em blocos.
      for (let page = 0; page < 40; page++) {
        const res = await base44.functions.invoke("segmentEmailFlows", {
          somente_com_email: true, offset, limit: 8000,
        });
        const d = res?.data;
        if (!d?.success) throw new Error(d?.error || "Falha ao segmentar clientes.");
        const cols = d.columns || [];
        for (const v of d.values || []) {
          const row = {};
          cols.forEach((c, i) => { row[c] = v[i] ?? ""; });
          rows.push(row);
        }
        meta = d;
        setProgress({ loaded: rows.length, total: d.total });
        if (!d.has_more || !d.values?.length) break;
        offset = rows.length;
      }
      setData({ ...meta, rows });
    } catch (e) {
      setError(e.message || String(e));
    } finally { setLoading(false); setProgress(null); }
  };

  const download = () => {
    if (!data?.rows?.length) return;
    downloadEmailFlowsWorkbook(data);
  };

  const counts = data?.rows
    ? Object.entries(data.rows.reduce((a, r) => ({ ...a, [r.fluxo]: (a[r.fluxo] || 0) + 1 }), {})).sort(([a], [b]) => a.localeCompare(b))
    : [];

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <Button onClick={load} disabled={loading} className="bg-purple-600 hover:bg-purple-700">
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          {loading
            ? progress
              ? `Carregando ${progress.loaded.toLocaleString("pt-BR")} de ${Number(progress.total || 0).toLocaleString("pt-BR")}…`
              : "Segmentando clientes…"
            : "Gerar segmentação"}
        </Button>
        <Button onClick={download} disabled={!data?.rows?.length} variant="outline" className="border-gray-700 bg-gray-900 text-gray-200 hover:bg-gray-800 hover:text-white">
          <Download className="w-4 h-4 mr-2" /> Baixar Excel (.xlsx)
        </Button>
      </div>

      {error && <div className="bg-red-950/40 border border-red-800/50 rounded-lg px-4 py-3 text-sm text-red-300">{error}</div>}

      {data && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {counts.map(([fluxo, qtd]) => (
              <div key={fluxo} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="text-xs text-gray-400 leading-snug">{fluxo}</div>
                <div className="text-2xl font-semibold text-white mt-1">{qtd.toLocaleString("pt-BR")}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500">
            {data.rows.length.toLocaleString("pt-BR")} clientes com e-mail ·{" "}
            {(data.clientes_sem_email || 0).toLocaleString("pt-BR")} sem e-mail (fora do arquivo) ·{" "}
            {(data.excluidos_em_locacao_ativa || 0).toLocaleString("pt-BR")} com locação ativa (excluídos)
          </p>
        </div>
      )}
    </div>
  );
}