import { useState } from "react";
import * as XLSX from "xlsx";
import { Download } from "lucide-react";
import { getEmpresaLabel } from "@/lib/empresaLabels";

const COLS = [
  ["Código cliente", (c) => String(c.cd_pessoa ?? "")],
  ["Nome", (c) => c.nm_pessoa || ""],
  ["Tipo pessoa", (c) => c.tipo_pessoa || ""],
  ["CNPJ/CPF", (c) => String(c.documento || "")],
  ["Cidade", (c) => c.cidade || ""],
  ["UF", (c) => c.uf || ""],
  ["Data cadastro", (c) => c.dt_cadastro || ""],
  ["Cód. empresa", (c) => String(c.cd_empresa ?? "")],
  ["Empresa", (c) => getEmpresaLabel(c.cd_empresa, c.empresa_nome)],
  ["Razão social empresa", (c) => c.empresa_nome || ""],
  ["Status", (c) => c.status || ""],
  ["Contratos abertos", (c) => Number(c.fichas_abertas) || 0],
  ["Última ficha", (c) => c.ultima_ficha || ""],
];

const sheetName = (s) => (s || "Sem empresa").replace(/[\\/?*[\]:]/g, " ").slice(0, 31);

export default function EmpresaClientesExport({ clients = [], empresas = [] }) {
  const [empresa, setEmpresa] = useState("todas");
  const [status, setStatus] = useState("ATIVO");
  const [soContrato, setSoContrato] = useState(true);

  const filtered = clients.filter((c) =>
    (empresa === "todas" || String(c.cd_empresa) === empresa) &&
    (status === "todos" || c.status === status) &&
    (!soContrato || Number(c.fichas_abertas) > 0)
  );

  const exportar = () => {
    const wb = XLSX.utils.book_new();
    const groups = {};
    filtered.forEach((c) => { (groups[c.cd_empresa == null ? "Sem empresa" : getEmpresaLabel(c.cd_empresa, c.empresa_nome)] ||= []).push(c); });
    const used = new Set();
    Object.entries(groups).forEach(([nome, rows]) => {
      const data = [COLS.map((c) => c[0]), ...rows.map((r) => COLS.map((c) => c[1](r)))];
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws["!cols"] = COLS.map(([h]) => ({ wch: Math.max(h.length + 2, 14) }));
      ws["!autofilter"] = { ref: ws["!ref"] };
      let n = sheetName(nome), i = 2;
      while (used.has(n)) n = sheetName(nome).slice(0, 28) + " " + i++;
      used.add(n);
      XLSX.utils.book_append_sheet(wb, ws, n);
    });
    if (!wb.SheetNames.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([COLS.map((c) => c[0])]), "Clientes");
    XLSX.writeFile(wb, `clientes_por_empresa_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const sel = "bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs";
  return (
    <div className="px-4 py-3 border-b border-gray-800 flex flex-wrap items-center gap-2">
      <select value={empresa} onChange={(e) => setEmpresa(e.target.value)} className={sel}>
        <option value="todas">Todas as empresas</option>
        {empresas.map((e) => <option key={String(e.cd_empresa)} value={String(e.cd_empresa)}>{getEmpresaLabel(e.cd_empresa, e.empresa_nome)}</option>)}
      </select>
      <select value={status} onChange={(e) => setStatus(e.target.value)} className={sel}>
        <option value="todos">Todos os status</option>
        <option value="ATIVO">Ativos</option>
        <option value="EM RISCO">Em risco</option>
        <option value="INATIVO">Inativos</option>
      </select>
      <label className="flex items-center gap-1.5 text-gray-300 text-xs">
        <input type="checkbox" checked={soContrato} onChange={(e) => setSoContrato(e.target.checked)} />
        Somente com contrato aberto
      </label>
      <span className="text-gray-500 text-xs">{filtered.length} clientes</span>
      <button onClick={exportar} disabled={!filtered.length} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-green-700 hover:bg-green-600 rounded-lg text-white text-xs font-medium disabled:opacity-50">
        <Download className="w-3.5 h-3.5" /> Exportar Excel
      </button>
    </div>
  );
}