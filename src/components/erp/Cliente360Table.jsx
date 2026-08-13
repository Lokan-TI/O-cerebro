import { useState, useMemo } from "react";
import { Search, Download, Loader2 } from "lucide-react";
import { fmtDoc, onlyDigits } from "@/lib/erpFormat";
import { fetchAllClientesCadastro, exportClientesCadastroCsv } from "@/components/erp/clientesCadastroExport";
import { useErpSource } from "@/lib/ErpSourceContext";

const brl = (v) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const STATUS_STYLE = {
  ATIVO: "bg-green-900/50 text-green-300",
  "EM RISCO": "bg-amber-900/50 text-amber-300",
  INATIVO: "bg-gray-700 text-gray-300",
  CHURN: "bg-red-900/50 text-red-300",
  "SEM MOVIMENTO": "bg-gray-800 text-gray-500",
  "SEM DATA": "bg-gray-800 text-gray-500",
};

const PAGE = 50;

export default function Cliente360Table({ clients = [], truncated }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("todos");
  const [page, setPage] = useState(0);
  const { selectedSource } = useErpSource() || {};
  const [exporting, setExporting] = useState(null);
  const [exportError, setExportError] = useState(null);

  const handleExport = async () => {
    if (!selectedSource?.id) return;
    setExportError(null);
    setExporting(0);
    try {
      const cadastro = await fetchAllClientesCadastro(selectedSource.id, (n) => setExporting(n));
      const metricsByCd = Object.fromEntries(clients.map((c) => [String(c.cd_pessoa), c]));
      exportClientesCadastroCsv(cadastro, metricsByCd);
    } catch (e) {
      setExportError(e.message || "Falha ao exportar a base de clientes.");
    } finally {
      setExporting(null);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((c) => {
      if (status !== "todos" && c.status !== status) return false;
      if (!q) return true;
      return (
        String(c.cd_pessoa).includes(q) ||
        (c.nm_pessoa || "").toLowerCase().includes(q) ||
        (c.global_id || "").toLowerCase().includes(q) ||
        (onlyDigits(search) ? onlyDigits(c.documento).includes(onlyDigits(search)) : false)
      );
    });
  }, [clients, search, status]);

  const pageRows = filtered.slice(page * PAGE, page * PAGE + PAGE);
  const statuses = [...new Set(clients.map((c) => c.status))];

  return (
    <div className="space-y-3">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Buscar por ID global, código, nome ou documento..."
            className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-1.5 text-sm text-white placeholder-gray-500"
          />
        </div>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(0); }}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white"
        >
          <option value="todos">Todos os status</option>
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button
          onClick={handleExport}
          disabled={exporting !== null || !selectedSource?.id}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-700 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
          title="Baixar toda a base de clientes com relacionamento e dados cadastrais completos"
        >
          {exporting !== null
            ? <><Loader2 className="w-4 h-4 animate-spin" /> {exporting} registros...</>
            : <><Download className="w-4 h-4" /> Exportar Excel</>}
        </button>
      </div>

      {exportError && (
        <div className="bg-red-950/50 border border-red-900 text-red-300 rounded-lg px-4 py-2 text-sm">{exportError}</div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-800/50 text-gray-400 text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-3">ID global</th>
                <th className="text-left px-4 py-3">Cliente</th>
                <th className="text-left px-4 py-3">CNPJ/CPF</th>
                <th className="text-left px-4 py-3">Empresa</th>
                <th className="text-center px-4 py-3">Status</th>
                <th className="text-center px-4 py-3">Fichas</th>
                <th className="text-center px-4 py-3">NFs</th>
                <th className="text-right px-4 py-3">Faturamento</th>
                <th className="text-right px-4 py-3">Ticket médio</th>
                <th className="text-right px-4 py-3">CAR aberto</th>
                <th className="text-left px-4 py-3">Última atividade</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr><td colSpan={11} className="text-center py-12 text-gray-500 text-sm">Nenhum cliente encontrado.</td></tr>
              ) : pageRows.map((c, i) => (
                <tr key={c.global_id} className={`border-t border-gray-800 hover:bg-gray-800/30 ${i % 2 ? "bg-gray-800/20" : ""}`}>
                  <td className="px-4 py-2.5 text-gray-400 font-mono text-xs">{c.global_id}</td>
                  <td className="px-4 py-2.5 text-white font-medium">{c.nm_pessoa || "—"}</td>
                  <td className="px-4 py-2.5 text-gray-400 font-mono text-xs whitespace-nowrap">{fmtDoc(c.documento) || "—"}</td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs">{c.empresa_nome || "—"}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLE[c.status] || "bg-gray-800 text-gray-400"}`}>{c.status}</span>
                  </td>
                  <td className="px-4 py-2.5 text-center text-gray-300">{c.qtd_fichas}</td>
                  <td className="px-4 py-2.5 text-center text-gray-300">{c.qtd_nf}</td>
                  <td className="px-4 py-2.5 text-right text-white font-medium">{brl(c.faturamento)}</td>
                  <td className="px-4 py-2.5 text-right text-gray-400">{brl(c.ticket_medio)}</td>
                  <td className="px-4 py-2.5 text-right text-purple-300">{c.car_aberto > 0 ? brl(c.car_aberto) : "—"}</td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs">{c.ultima_atividade || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 bg-gray-800/30 border-t border-gray-800 flex items-center justify-between text-xs text-gray-400">
          <span>
            {filtered.length} cliente(s){truncated ? " · lista truncada nos 3.000 maiores" : ""}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
              className="px-2 py-1 bg-gray-800 border border-gray-700 rounded disabled:opacity-40">Anterior</button>
            <span>Página {page + 1} de {Math.max(1, Math.ceil(filtered.length / PAGE))}</span>
            <button onClick={() => setPage((p) => (p + 1) * PAGE < filtered.length ? p + 1 : p)}
              disabled={(page + 1) * PAGE >= filtered.length}
              className="px-2 py-1 bg-gray-800 border border-gray-700 rounded disabled:opacity-40">Próxima</button>
          </div>
        </div>
      </div>
    </div>
  );
}