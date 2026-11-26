import { useEffect, useMemo, useState } from "react";
import { invokeFichasStatus } from "@/components/erp/fichasStatusApi";
import { fmtNum } from "@/lib/erpFormat";
import FichasStatusTable from "@/components/erp/FichasStatusTable";
import { exportFichasStatus } from "@/components/erp/fichasStatusExport";
import FichasReativacaoButton from "@/components/erp/FichasReativacaoButton";
import { Download, RefreshCw } from "lucide-react";

// Fichas de locação dos status marcados (todas quando nenhum está marcado), uma linha por ficha:
// todos os clientes, com ou sem faturamento, e todas as datas — como na tela do Sisloc.
export default function FichasStatusView({ sourceId, selectedEmpresa, fichaStatus, search, limit }) {
  const [fichas, setFichas] = useState(null);
  const [loaded, setLoaded] = useState(0);
  const [error, setError] = useState(null);
  const [reload, setReload] = useState(0);
  const statusKey = fichaStatus.map((s) => s.replace("fichas_", "")).join(",");

  useEffect(() => {
    let alive = true;
    setFichas(null); setError(null); setLoaded(0);
    const run = async () => {
      const all = [];
      for (let after = 0, more = true; more && alive;) {
        const payload = { after, statuses: statusKey ? statusKey.split(",") : [] };
        if (sourceId) payload.source_id = sourceId;
        if (selectedEmpresa != null) payload.cd_empresa = selectedEmpresa;
        const data = await invokeFichasStatus(payload);
        all.push(...data.rows);
        after = data.next_after; more = data.has_more;
        if (alive) setLoaded(all.length);
      }
      if (alive) setFichas(all);
    };
    const t = setTimeout(() => run().catch((e) => alive && setError(e?.response?.data?.error || e.message)), 400);
    return () => { alive = false; clearTimeout(t); };
  }, [sourceId, selectedEmpresa, statusKey, reload]);

  const rows = useMemo(() => {
    let list = fichas || [];
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((f) => f.nm_pessoa.toLowerCase().includes(q) || f.cd_pessoa.includes(q) || String(f.numero).includes(q) || f.nm_empresa.toLowerCase().includes(q));
    return list;
  }, [fichas, search]);

  if (error) {
    return (
      <div className="bg-red-950/40 border border-red-800/50 rounded-lg px-4 py-2 text-red-300 text-sm flex items-center justify-between gap-3">
        <span>Não foi possível carregar as fichas: {error}</span>
        <button onClick={() => setReload((n) => n + 1)} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-white text-xs"><RefreshCw className="w-3.5 h-3.5" /> Tentar novamente</button>
      </div>
    );
  }
  if (!fichas) return <div className="text-gray-500 p-8 text-center">Consultando fichas no ERP… {loaded > 0 && `${fmtNum(loaded)} carregadas`}</div>;

  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm text-gray-400">
          <span className="text-white font-medium">{fmtNum(rows.length)} fichas</span> de {fmtNum(new Set(rows.map((f) => f.cd_pessoa)).size)} clientes
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <FichasReativacaoButton sourceId={sourceId} selectedEmpresa={selectedEmpresa} />
          <button onClick={() => exportFichasStatus(rows)} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 rounded-lg text-white text-xs font-medium">
            <Download className="w-3.5 h-3.5" /> Exportar Excel
          </button>
        </div>
      </div>
      <FichasStatusTable rows={rows.slice(0, limit)} />
      <div className="text-xs text-gray-600">
        {rows.length > limit
          ? `Exibindo ${fmtNum(limit)} de ${fmtNum(rows.length)} — a exportação inclui todas as ${fmtNum(rows.length)} fichas filtradas.`
          : `Todas as ${fmtNum(rows.length)} fichas estão listadas.`}
        {" "}Linha = ficha de locação · inclui clientes sem faturamento.
      </div>
    </>
  );
}