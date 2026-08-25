import { useEffect, useMemo, useState } from "react";
import { useErpSource, ALL_SOURCES_ID } from "@/lib/ErpSourceContext";
import { useEmpresaFilter } from "@/lib/EmpresaFilterContext";
import { fetchClientesAtivos } from "@/components/erp/clientesAtivosCache";
import { exportClientesAtivosCsv } from "@/components/erp/clientesAtivosExport";
import { fmtCur, fmtNum, fmtMonthLabel } from "@/lib/erpFormat";
import { Calendar, Download, X } from "lucide-react";

const lastDay = (ano, mes) => new Date(ano, mes, 0).getDate();

// Lista os clientes que geraram receita (NF) no mês clicado no gráfico.
export default function ClientesMesPanel({ ano, mes, onClose }) {
  const { selectedSource } = useErpSource();
  const { selectedEmpresa } = useEmpresaFilter();
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const start = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const end = `${ano}-${String(mes).padStart(2, "0")}-${String(lastDay(ano, mes)).padStart(2, "0")}`;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    const sourceId = selectedSource?.id && selectedSource.id !== ALL_SOURCES_ID ? selectedSource.id : null;
    fetchClientesAtivos(sourceId, start, end)
      .then((d) => { if (alive) setRows(d?.rows || []); })
      .catch((e) => { if (alive) setError(e?.message || "Falha ao carregar clientes do mês"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [start, end, selectedSource?.id]);

  const list = useMemo(() => {
    let l = rows || [];
    if (selectedEmpresa != null) l = l.filter((r) => Number(r.cd_empresa) === Number(selectedEmpresa));
    const total = l.reduce((s, r) => s + r.receita, 0);
    return l
      .map((r) => ({ ...r, share: total > 0 ? (r.receita / total) * 100 : 0 }))
      .sort((a, b) => b.receita - a.receita);
  }, [rows, selectedEmpresa]);

  const totalReceita = list.reduce((s, r) => s + r.receita, 0);

  return (
    <div className="bg-gray-900 border border-purple-700/50 rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-white font-semibold text-sm flex items-center gap-2">
          <Calendar className="w-4 h-4 text-purple-400" />
          Clientes ativos em {fmtMonthLabel(mes, ano)}
          <span className="text-gray-500 font-normal">· {fmtNum(list.length)} clientes · {fmtCur(totalReceita)}</span>
        </h3>
        <div className="flex items-center gap-2">
          {list.length > 0 && (
            <button onClick={() => exportClientesAtivosCsv(list)} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 rounded-lg text-white text-xs font-medium">
              <Download className="w-3.5 h-3.5" /> Exportar Excel
            </button>
          )}
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
      </div>

      {loading && <div className="text-gray-500 py-6 text-center">Consultando clientes do mês no ERP…</div>}
      {error && <div className="bg-red-950/40 border border-red-800/50 rounded-lg px-4 py-2 text-red-300 text-sm">{error}</div>}

      {!loading && !error && (
        <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-900">
              <tr className="text-gray-500 text-xs uppercase border-b border-gray-800">
                <th className="text-left py-2 px-3">#</th>
                <th className="text-left py-2 px-3">Cliente</th>
                <th className="text-left py-2 px-3">Empresa Sisloc</th>
                <th className="text-right py-2 px-3">Receita no mês</th>
                <th className="text-right py-2 px-3">%</th>
                <th className="text-right py-2 px-3">NFs</th>
                <th className="text-right py-2 px-3">Última NF</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r, i) => (
                <tr key={`${r.cd_empresa}-${r.cd_pessoa}-${i}`} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="py-2 px-3 text-gray-500">{i + 1}</td>
                  <td className="py-2 px-3 text-white">
                    <div className="truncate max-w-[260px]">{r.nm_pessoa}</div>
                    <div className="text-xs text-gray-600">#{r.cd_pessoa}</div>
                  </td>
                  <td className="py-2 px-3 text-gray-300 text-xs">{r.nm_empresa}</td>
                  <td className="py-2 px-3 text-right text-green-400 font-medium">{fmtCur(r.receita)}</td>
                  <td className="py-2 px-3 text-right text-gray-400">{r.share.toFixed(1)}%</td>
                  <td className="py-2 px-3 text-right text-gray-300">{fmtNum(r.nfs)}</td>
                  <td className="py-2 px-3 text-right text-gray-400 text-xs">{r.ultima_nf || "—"}</td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={7} className="text-center text-gray-600 py-6">Nenhum cliente com receita neste mês</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <div className="text-xs text-gray-600">Período consultado: {start} → {end} · receita = nf.vl_faturamento (NFs não canceladas)</div>
    </div>
  );
}