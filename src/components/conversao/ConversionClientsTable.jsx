import { useMemo, useState } from "react";
import { fmtCur, fmtNum, fmtDoc, onlyDigits } from "@/lib/erpFormat";
import { Search, AlertTriangle, Copy } from "lucide-react";

const PAGE_SIZE = 50;

const STATUS_STYLE = {
  "CONVERTIDO COM NOTA FISCAL": "bg-green-900/60 text-green-300",
  "COM FICHA SEM NOTA FISCAL": "bg-blue-900/60 text-blue-300",
  "CADASTRADO SEM FICHA": "bg-amber-900/60 text-amber-300",
  "NOTA FISCAL CANCELADA": "bg-red-900/60 text-red-300",
  "FICHA CANCELADA": "bg-red-900/60 text-red-300",
  "POSSÍVEL DUPLICIDADE": "bg-orange-900/60 text-orange-300",
  "TIPO DE PESSOA NÃO CONFIRMADO": "bg-gray-800 text-gray-400",
  "DADOS INCONSISTENTES": "bg-purple-900/60 text-purple-300",
};

const TIME_RANGES = [
  { key: "all", label: "Qualquer tempo", test: () => true },
  { key: "7", label: "Até 7 dias", test: (d) => d != null && d <= 7 },
  { key: "30", label: "Até 30 dias", test: (d) => d != null && d <= 30 },
  { key: "90", label: "Até 90 dias", test: (d) => d != null && d <= 90 },
  { key: "none", label: "Não convertido", test: (d) => d == null },
];

export default function ConversionClientsTable({ clients, truncated, statusList, empresaList, vendorList }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [vendedor, setVendedor] = useState("");
  const [tipo, setTipo] = useState("");
  const [coorte, setCoorte] = useState("");
  const [range, setRange] = useState("all");
  const [page, setPage] = useState(0);

  const coorteList = useMemo(
    () => [...new Set((clients || []).map((c) => c.coorte).filter(Boolean))].sort(),
    [clients]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rangeTest = TIME_RANGES.find((r) => r.key === range)?.test || (() => true);
    return (clients || []).filter((c) => {
      if (status && c.status !== status) return false;
      if (empresa && c.nm_empresa !== empresa) return false;
      if (vendedor && c.vendedor_ficha !== vendedor) return false;
      if (tipo && c.doc_tipo !== tipo) return false;
      if (coorte && c.coorte !== coorte) return false;
      if (!rangeTest(c.dias_nf)) return false;
      if (q) {
        const hay = [c.nome, c.cd_pessoa, c.nr_ficha, c.nr_nf].map((x) => String(x ?? "").toLowerCase());
        const qd = onlyDigits(search);
        const docHit = !!qd && onlyDigits(c.doc).includes(qd);
        if (!hay.some((h) => h.includes(q)) && !docHit) return false;
      }
      return true;
    });
  }, [clients, search, status, empresa, vendedor, tipo, coorte, range]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const rows = filtered.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);

  const selectCls = "px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-200";

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
        <h3 className="text-white font-semibold text-sm">
          Detalhe por novo cliente <span className="text-gray-500 font-normal">· {fmtNum(filtered.length)} registros</span>
        </h3>
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-2" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Nome, ID, CPF/CNPJ, ficha ou NF…"
            className="pl-8 pr-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-200 placeholder-gray-500 w-64 focus:outline-none focus:border-purple-500" />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <select className={selectCls} value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
          <option value="">Todos os status</option>
          {statusList.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className={selectCls} value={empresa} onChange={(e) => { setEmpresa(e.target.value); setPage(0); }}>
          <option value="">Todas as filiais</option>
          {empresaList.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className={selectCls} value={vendedor} onChange={(e) => { setVendedor(e.target.value); setPage(0); }}>
          <option value="">Todos os vendedores</option>
          {vendorList.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className={selectCls} value={tipo} onChange={(e) => { setTipo(e.target.value); setPage(0); }}>
          <option value="">PF e PJ</option>
          <option value="PF">Pessoa física</option>
          <option value="PJ">Pessoa jurídica</option>
          <option value="SEM DOC">Sem documento</option>
        </select>
        <select className={selectCls} value={coorte} onChange={(e) => { setCoorte(e.target.value); setPage(0); }}>
          <option value="">Todas as coortes</option>
          {coorteList.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className={selectCls} value={range} onChange={(e) => { setRange(e.target.value); setPage(0); }}>
          {TIME_RANGES.map((r) => <option key={r.key} value={r.key}>{r.label} até a NF</option>)}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs whitespace-nowrap">
          <thead>
            <tr className="text-gray-500 uppercase border-b border-gray-800">
              <th className="text-left py-2 px-2">ID global</th>
              <th className="text-left py-2 px-2">Nome</th>
              <th className="text-left py-2 px-2">CPF/CNPJ</th>
              <th className="text-left py-2 px-2">Cadastro</th>
              <th className="text-left py-2 px-2">Coorte</th>
              <th className="text-left py-2 px-2">Filial</th>
              <th className="text-left py-2 px-2">Vendedor 1ª ficha</th>
              <th className="text-left py-2 px-2">1ª ficha</th>
              <th className="text-right py-2 px-2">Dias</th>
              <th className="text-right py-2 px-2">Fichas</th>
              <th className="text-left py-2 px-2">1ª NF</th>
              <th className="text-right py-2 px-2">Dias</th>
              <th className="text-right py-2 px-2">Valor 1ª NF</th>
              <th className="text-right py-2 px-2">Total faturado</th>
              <th className="text-right py-2 px-2">NFs</th>
              <th className="text-left py-2 px-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.gid} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="py-2 px-2 text-gray-500 font-mono">{c.gid}</td>
                <td className="py-2 px-2 text-white max-w-[220px] truncate">
                  {c.nome}
                  {c.duplicidade && <Copy className="w-3 h-3 text-orange-400 inline ml-1" />}
                  {c.inconsistencias?.length > 0 && <AlertTriangle className="w-3 h-3 text-purple-400 inline ml-1" />}
                </td>
                <td className="py-2 px-2 text-gray-400">{fmtDoc(c.doc) || "—"} <span className="text-gray-600">{c.doc_tipo}</span></td>
                <td className="py-2 px-2 text-gray-300">{c.dt_cad || "—"}</td>
                <td className="py-2 px-2 text-gray-400">{c.coorte || "—"}</td>
                <td className="py-2 px-2 text-gray-400 max-w-[140px] truncate">{c.nm_empresa || "—"}</td>
                <td className="py-2 px-2 text-gray-400 max-w-[160px] truncate">{c.vendedor_ficha || "—"}</td>
                <td className="py-2 px-2 text-blue-400">{c.dt_ficha || "—"}{c.nr_ficha ? ` · #${c.nr_ficha}` : ""}</td>
                <td className="py-2 px-2 text-right text-gray-400">{c.dias_ficha ?? "—"}</td>
                <td className="py-2 px-2 text-right text-gray-400">{fmtNum(c.qtd_fichas)}</td>
                <td className="py-2 px-2 text-green-400">{c.dt_nf || "—"}{c.nr_nf ? ` · #${c.nr_nf}` : ""}</td>
                <td className="py-2 px-2 text-right text-gray-400">{c.dias_nf ?? "—"}</td>
                <td className="py-2 px-2 text-right text-gray-300">{c.vl_primeira_nf ? fmtCur(c.vl_primeira_nf) : "—"}</td>
                <td className="py-2 px-2 text-right text-green-400">{c.vl_total ? fmtCur(c.vl_total) : "—"}</td>
                <td className="py-2 px-2 text-right text-gray-400">{fmtNum(c.qtd_nfs)}</td>
                <td className="py-2 px-2">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_STYLE[c.status] || "bg-gray-800 text-gray-400"}`}>{c.status}</span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={16} className="text-center text-gray-600 py-6">Nenhum cliente encontrado</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
        <span>
          Página {current + 1} de {pages}
          {truncated && " · lista publicada limitada aos 2.000 cadastros mais recentes"}
        </span>
        <div className="flex gap-2">
          <button disabled={current === 0} onClick={() => setPage(current - 1)}
            className="px-3 py-1 bg-gray-800 border border-gray-700 rounded disabled:opacity-40 text-gray-300">Anterior</button>
          <button disabled={current >= pages - 1} onClick={() => setPage(current + 1)}
            className="px-3 py-1 bg-gray-800 border border-gray-700 rounded disabled:opacity-40 text-gray-300">Próxima</button>
        </div>
      </div>
    </div>
  );
}