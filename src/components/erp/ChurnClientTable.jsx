import { useState, useMemo } from "react";
import { Search, ArrowUpDown, Users, Download } from "lucide-react";

const PAGE_SIZE = 15;

const COLUMNS = [
  { key: "nm_pessoa", label: "Nome", type: "text" },
  { key: "documento", label: "CPF/CNPJ", type: "text", sortable: false },
  { key: "telefone", label: "Telefone", type: "text", sortable: false },
  { key: "en_mail_pessoa", label: "E-mail", type: "text", sortable: false },
  { key: "uf_pessoa", label: "UF", type: "text" },
  { key: "cidade_pessoa", label: "Cidade", type: "text" },
  { key: "produtos_locados", label: "Produtos Locados", type: "text", sortable: false },
  { key: "ref_revenue", label: "Receita (Ref.)", type: "currency" },
  { key: "ref_nfs", label: "NFs", type: "number" },
  { key: "last_activity", label: "Última atividade", type: "date" },
  { key: "billing_cycle", label: "Ciclo cobrança", type: "text" },
  { key: "rental_period_description", label: "Tipo locação SISLOC", type: "text" },
  { key: "contract_horizon_days", label: "Horizonte contrato", type: "number" },
  { key: "ref_last_nf", label: "Última NF", type: "date" },
  { key: "prim_dt_pedido", label: "1º Contrato", type: "date" },
  { key: "ult_dt_enc_ficha", label: "Encerr. Contrato", type: "date" },
  { key: "total_contratos", label: "Contratos", type: "number" },
  { key: "qtd_renovacoes", label: "Renovações", type: "number" },
  { key: "total_valor_locado", label: "Valor Locado", type: "currency" },
];

function getDocumento(c) {
  if (c.fl_tipo_pessoa === "J") return c.nr_cnpj_pessoa || "—";
  return c.nr_cpf_pessoa || "—";
}

function exportToCsv(clients) {
  const headers = [
    "Codigo", "Nome", "Tipo", "CPF", "CNPJ", "Telefone", "E-mail",
    "UF", "Cidade", "Receita Periodo Ref", "NFs", "Primeira NF", "Ultima NF",
    "Ultima Atividade", "Dias Sem Atividade", "Ultima Remessa", "Ultimo Faturamento Contrato", "Ultima Movimentacao Estoque",
    "Ciclo Cobranca", "Tipo Locacao SISLOC", "Dias Periodo", "Periodos Contrato", "Horizonte Contrato Dias",
    "Primeiro Contrato", "Ultimo Pedido", "Encerramento Contrato",
    "Total Contratos", "Renovacoes", "Valor Encerramento",
    "Produtos Locados", "Codigos Equipamento", "Qtd Total Locado", "Valor Total Locado",
  ];
  const escape = (v) => {
    if (v == null) return "";
    const s = String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = clients.map((c) => [
    c.cd_pessoa, c.nm_pessoa, c.fl_tipo_pessoa || "",
    c.nr_cpf_pessoa || "", c.nr_cnpj_pessoa || "",
    c.telefone || "", c.en_mail_pessoa || "",
    c.uf_pessoa || "", c.cidade_pessoa || "",
    c.ref_revenue, c.ref_nfs, c.ref_first_nf, c.ref_last_nf,
    c.last_activity, c.days_since_last_activity, c.last_remessa, c.last_contract_billing, c.last_estmov,
    c.billing_cycle, c.rental_period_description, c.rental_period_days, c.contract_periods, c.contract_horizon_days,
    c.prim_dt_pedido, c.ult_dt_pedido, c.ult_dt_enc_ficha,
    c.total_contratos, c.qtd_renovacoes, c.total_encerramento,
    c.produtos_locados || "", c.codigos_equipto || "",
    c.total_qt_locado, c.total_valor_locado,
  ].map(escape).join(";"));
  const csv = [headers.join(";"), ...rows].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `churn-clientes-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function ChurnClientTable({ clients }) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("ref_revenue");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    let list = clients || [];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.nm_pessoa?.toLowerCase().includes(q) ||
          c.cd_pessoa?.toLowerCase().includes(q) ||
          getDocumento(c)?.toLowerCase().includes(q) ||
          c.uf_pessoa?.toLowerCase().includes(q) ||
          c.cidade_pessoa?.toLowerCase().includes(q)
      );
    }
    list = [...list].sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      if (typeof av === "string") return sortDir === "desc" ? bv.localeCompare(av) : av.localeCompare(bv);
      return sortDir === "desc" ? bv - av : av - bv;
    });
    return list;
  }, [clients, search, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(sortDir === "desc" ? "asc" : "desc");
    else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(0);
  };

  const fmtCurrency = (v) =>
    v != null && !isNaN(v)
      ? Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
      : "—";
  const fmtDate = (d) => (d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—");
  const inactivityLabel = (days) => {
    if (days == null || !Number.isFinite(Number(days))) return "—";
    const d = Number(days);
    const months = d / 30.4375;
    return months >= 1 ? `${months.toFixed(1)} meses` : `${d} dias`;
  };
  const fmtText = (v) => (v ? v : "—");

  if (!clients || clients.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
        <Users className="w-10 h-10 text-gray-700 mx-auto mb-2" />
        <p className="text-gray-400">Nenhum cliente perdido neste período.</p>
        <p className="text-gray-500 text-sm mt-1">Todos os clientes da base de referência continuaram comprando.</p>
      </div>
    );
  }

  const SortHeader = ({ k, children }) => (
    <th className="px-3 py-3 text-left cursor-pointer hover:text-white whitespace-nowrap" onClick={() => toggleSort(k)}>
      <span className="flex items-center gap-1">
        {children} <ArrowUpDown className="w-3 h-3" />
      </span>
    </th>
  );

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-gray-800 gap-3 flex-wrap">
        <h3 className="text-white font-semibold text-sm">
          Churn confirmado — sem contrato vigente e sem atividade válida ({filtered.length})
        </h3>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="Buscar por nome, CPF/CNPJ, cidade..."
              className="bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500 w-64"
            />
          </div>
          <button
            onClick={() => exportToCsv(filtered)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-700 hover:bg-green-600 text-white rounded-lg text-xs font-medium transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar CSV
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-800/50 text-gray-400 text-xs uppercase tracking-wider">
              {COLUMNS.map((col) =>
                col.sortable === false ? (
                  <th key={col.key} className="px-3 py-3 text-left whitespace-nowrap">{col.label}</th>
                ) : (
                  <SortHeader key={col.key} k={col.key}>{col.label}</SortHeader>
                )
              )}
              <th className="px-3 py-3 text-left whitespace-nowrap">Tempo Sem Comprar</th>
            </tr>
          </thead>
          <tbody>
            {pageData.map((c, i) => (
              <tr key={c.cd_pessoa} className={i % 2 === 0 ? "bg-gray-900" : "bg-gray-800/30"}>
                <td className="px-3 py-3 text-white font-medium whitespace-nowrap">{fmtText(c.nm_pessoa)}</td>
                <td className="px-3 py-3 text-gray-300 whitespace-nowrap">{getDocumento(c)}</td>
                <td className="px-3 py-3 text-gray-300 whitespace-nowrap">{fmtText(c.telefone)}</td>
                <td className="px-3 py-3 text-gray-300 max-w-[180px] truncate" title={c.en_mail_pessoa}>{fmtText(c.en_mail_pessoa)}</td>
                <td className="px-3 py-3 text-gray-300 whitespace-nowrap">{fmtText(c.uf_pessoa)}</td>
                <td className="px-3 py-3 text-gray-300 whitespace-nowrap">{fmtText(c.cidade_pessoa)}</td>
                <td className="px-3 py-3 text-gray-300 max-w-[220px] truncate" title={c.produtos_locados}>{fmtText(c.produtos_locados)}</td>
                <td className="px-3 py-3 text-red-400 font-medium whitespace-nowrap">{fmtCurrency(c.ref_revenue)}</td>
                <td className="px-3 py-3 text-gray-300 whitespace-nowrap">{c.ref_nfs}</td>
                <td className="px-3 py-3 text-cyan-300 whitespace-nowrap">{fmtDate(c.last_activity)}</td>
                <td className="px-3 py-3 text-gray-300 whitespace-nowrap">{fmtText(c.billing_cycle)}</td>
                <td className="px-3 py-3 text-gray-300 max-w-[180px] truncate" title={c.rental_period_description}>{fmtText(c.rental_period_description)}</td>
                <td className="px-3 py-3 text-gray-300 whitespace-nowrap">{c.contract_horizon_days != null ? `${c.contract_horizon_days} dias` : "—"}</td>
                <td className="px-3 py-3 text-gray-300 whitespace-nowrap">{fmtDate(c.ref_last_nf)}</td>
                <td className="px-3 py-3 text-gray-300 whitespace-nowrap">{fmtDate(c.prim_dt_pedido)}</td>
                <td className="px-3 py-3 text-gray-300 whitespace-nowrap">{fmtDate(c.ult_dt_enc_ficha)}</td>
                <td className="px-3 py-3 text-gray-300 whitespace-nowrap">{c.total_contratos}</td>
                <td className="px-3 py-3 text-gray-300 whitespace-nowrap">
                  {c.qtd_renovacoes > 0 ? (
                    <span className="text-green-400 font-medium">{c.qtd_renovacoes}</span>
                  ) : (
                    <span className="text-gray-600">0</span>
                  )}
                </td>
                <td className="px-3 py-3 text-gray-300 whitespace-nowrap">{fmtCurrency(c.total_valor_locado)}</td>
                <td className="px-3 py-3 text-orange-400 whitespace-nowrap">{inactivityLabel(c.days_since_last_activity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between p-4 border-t border-gray-800">
          <p className="text-gray-500 text-xs">Página {page + 1} de {totalPages}</p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 rounded-lg text-xs"
            >
              Anterior
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 rounded-lg text-xs"
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  );
}