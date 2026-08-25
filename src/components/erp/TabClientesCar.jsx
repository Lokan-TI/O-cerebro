import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useErpSource } from "@/lib/ErpSourceContext";
import { useGlobalFilter } from "@/lib/GlobalFilterContext";
import QueryInspector from "@/components/erp/QueryInspector";
import { Download, RefreshCw, Search, FileSpreadsheet } from "lucide-react";
import { fmtDoc, onlyDigits } from "@/lib/erpFormat";

export default function TabClientesCar() {
  const { selectedSource } = useErpSource();
  const { period } = useGlobalFilter();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [summary, setSummary] = useState({ total_clients: 0, total_value: 0, total_open: 0, total_vencido: 0, total_provisorio: 0, total_juros_multa: 0 });
  const [queries, setQueries] = useState(null);

  const fetchClients = useCallback(async () => {
    if (!selectedSource) return;
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("listActiveCarClients", {
        source_id: selectedSource.id,
        start_date: period.start,
        end_date: period.endExclusive,
        only_open: onlyOpen,
      });
      const result = res?.data || res;
      if (result?.success) {
        setClients(result.clients || []);
        setQueries(result.queries || null);
        setSummary({
          total_clients: result.total_clients || 0,
          total_value: result.total_value || 0,
          total_open: result.total_open || 0,
          total_vencido: result.total_vencido || 0,
          total_provisorio: result.total_provisorio || 0,
          total_juros_multa: result.total_juros_multa || 0,
        });
      } else {
        setError(result?.error || "Falha ao buscar clientes.");
      }
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }, [selectedSource, period.start, period.end, onlyOpen]);

  useEffect(() => {
    fetchClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSource?.id, period.start, period.end, onlyOpen]);

  const filtered = (clients || []).filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    const qd = onlyDigits(search);
    return (
      String(c.cd_pessoa).includes(q) ||
      (c.nm_pessoa || "").toLowerCase().includes(q) ||
      (!!qd && onlyDigits(c.documento).includes(qd))
    );
  });

  const formatBRL = (v) =>
    (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const formatBRL0 = (v) =>
    (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  const exportToExcel = () => {
    const headers = [
      "Código",
      "Nome do Cliente",
      "CNPJ/CPF",
      "Empresa",
      "Qtd. CAR",
      "Qtd. em Aberto",
      "Valor Total",
      "Valor em Aberto",
      "Valor Vencido",
      "Valor Liquidado",
      "Valor Provisório",
      "Juros/Multa",
      "Primeira Emissão",
      "Última Emissão",
      "Primeiro Vencimento",
      "Último Vencimento",
    ];

    const rows = filtered.map(c => [
      c.cd_pessoa,
      c.nm_pessoa,
      fmtDoc(c.documento),
      c.cd_empresa || "",
      c.qtd_car,
      c.qtd_em_aberto,
      (Number(c.vl_total) || 0).toFixed(2),
      (Number(c.vl_em_aberto) || 0).toFixed(2),
      (Number(c.vl_vencido) || 0).toFixed(2),
      (Number(c.vl_liquidado) || 0).toFixed(2),
      (Number(c.vl_provisorio) || 0).toFixed(2),
      (Number(c.vl_juros_multa) || 0).toFixed(2),
      c.primeira_emi || "",
      c.ultima_emi || "",
      c.primeiro_venc || "",
      c.ultimo_venc || "",
    ]);

    // CSV with BOM for Excel compatibility
    const escapeCSV = (v) => {
      const s = String(v ?? "");
      if (s.includes(";") || s.includes('"') || s.includes("\n")) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };

    const csv = [headers, ...rows]
      .map(r => r.map(escapeCSV).join(";"))
      .join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clientes_car_${period.start}_${period.end}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Controles */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-wrap items-center gap-3">
        <div className="text-xs text-gray-400">
          Período do filtro global: <span className="text-white font-medium">{period.start}</span> →{" "}
          <span className="text-white font-medium">{period.end}</span>
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={onlyOpen}
            onChange={(e) => setOnlyOpen(e.target.checked)}
            className="accent-purple-500"
          />
          <span className="text-gray-300 text-sm">Apenas com CAR em aberto</span>
        </label>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por código ou nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-1.5 text-sm text-white placeholder-gray-500"
          />
        </div>

        <QueryInspector queries={queries} title="Queries — Clientes CAR" />

        <button
          onClick={fetchClients}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-300 text-sm transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </button>

        <button
          onClick={exportToExcel}
          disabled={loading || filtered.length === 0}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-green-600 hover:bg-green-500 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          <FileSpreadsheet className="w-4 h-4" />
          Exportar Excel
        </button>
      </div>

      {/* Resumo — regra canônica do CAR (valor = previsto + acréscimo − desconto · cancelados excluídos · provisório à parte) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-xs uppercase tracking-wide">Clientes ativos</p>
          <p className="text-2xl font-bold text-white mt-1">{summary.total_clients}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-xs uppercase tracking-wide">Total a receber</p>
          <p className="text-2xl font-bold text-white mt-1">{formatBRL0(summary.total_value)}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-xs uppercase tracking-wide">Em aberto</p>
          <p className="text-2xl font-bold text-purple-400 mt-1">{formatBRL0(summary.total_open)}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-xs uppercase tracking-wide">Vencido</p>
          <p className="text-2xl font-bold text-red-400 mt-1">{formatBRL0(summary.total_vencido)}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-xs uppercase tracking-wide">Provisório</p>
          <p className="text-2xl font-bold text-gray-400 mt-1">{formatBRL0(summary.total_provisorio)}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-xs uppercase tracking-wide">Juros/multa</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{formatBRL0(summary.total_juros_multa)}</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Tabela */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-800/50 text-gray-400 text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-3">Código</th>
                <th className="text-left px-4 py-3">Nome do Cliente</th>
                <th className="text-left px-4 py-3">CNPJ/CPF</th>
                <th className="text-center px-4 py-3">Qtd CAR</th>
                <th className="text-center px-4 py-3">Em Aberto</th>
                <th className="text-right px-4 py-3">Valor Total</th>
                <th className="text-right px-4 py-3">Em Aberto</th>
                <th className="text-right px-4 py-3">Vencido</th>
                <th className="text-right px-4 py-3">Liquidado</th>
                <th className="text-right px-4 py-3">Juros/Multa</th>
                <th className="text-left px-4 py-3">Última Emissão</th>
                <th className="text-left px-4 py-3">Últ. Vencimento</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={12} className="text-center py-12">
                    <div className="w-8 h-8 border-4 border-gray-700 border-t-purple-500 rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">Carregando clientes ativos...</p>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center py-12 text-gray-500 text-sm">
                    Nenhum cliente encontrado.
                  </td>
                </tr>
              ) : (
                filtered.map((c, i) => (
                  <tr
                    key={c.cd_pessoa}
                    className={`border-t border-gray-800 hover:bg-gray-800/30 ${i % 2 === 0 ? "" : "bg-gray-800/20"}`}
                  >
                    <td className="px-4 py-2.5 text-gray-300 font-mono text-xs">{c.cd_pessoa}</td>
                    <td className="px-4 py-2.5 text-white font-medium">{c.nm_pessoa}</td>
                    <td className="px-4 py-2.5 text-gray-400 font-mono text-xs whitespace-nowrap">{fmtDoc(c.documento) || "—"}</td>
                    <td className="px-4 py-2.5 text-center text-gray-300">{c.qtd_car}</td>
                    <td className="px-4 py-2.5 text-center">
                      {c.qtd_em_aberto > 0 ? (
                        <span className="px-2 py-0.5 rounded bg-purple-900/50 text-purple-300 text-xs font-medium">
                          {c.qtd_em_aberto}
                        </span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right text-white font-medium">{formatBRL(c.vl_total)}</td>
                    <td className="px-4 py-2.5 text-right text-purple-300">{c.vl_em_aberto > 0 ? formatBRL(c.vl_em_aberto) : "—"}</td>
                    <td className="px-4 py-2.5 text-right text-red-400">{c.vl_vencido > 0 ? formatBRL(c.vl_vencido) : "—"}</td>
                    <td className="px-4 py-2.5 text-right text-gray-400">{c.vl_liquidado > 0 ? formatBRL(c.vl_liquidado) : "—"}</td>
                    <td className="px-4 py-2.5 text-right text-amber-400">{c.vl_juros_multa > 0 ? formatBRL(c.vl_juros_multa) : "—"}</td>
                    <td className="px-4 py-2.5 text-gray-400 text-xs">{c.ultima_emi || "—"}</td>
                    <td className="px-4 py-2.5 text-gray-400 text-xs">{c.ultimo_venc || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length > 0 && (
          <div className="px-4 py-3 bg-gray-800/30 border-t border-gray-800 text-gray-400 text-xs">
            {filtered.length} cliente(s) exibido(s) de {clients.length} total
          </div>
        )}
      </div>
    </div>
  );
}