import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { fmtDoc } from "@/lib/erpFormat";
import { STATUS, FIELDS } from "./cnpjDiff";

export default function CnpjDiffTable({ results, groups }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("divergente");
  const list = useMemo(() => {
    const s = q.trim().toLowerCase(), d = q.replace(/\D/g, "");
    return results.filter((r) => (status === "all" || r.status === status)
      && (!s || r.nm_pessoa?.toLowerCase().includes(s) || (d && r.cnpj.includes(d))));
  }, [results, q, status]);
  const inGroup = (d) => groups.has(FIELDS.find((f) => f.key === d.field)?.group);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl">
      <div className="flex flex-wrap items-center gap-2 p-3 border-b border-gray-800">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou CNPJ…" className="pl-8 pr-3 py-1.5 bg-gray-950 border border-gray-800 rounded-lg text-sm text-white w-64 focus:outline-none focus:border-purple-500" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="bg-gray-950 border border-gray-800 rounded-lg text-sm text-white px-2 py-1.5">
          <option value="all">Todos os status</option>
          {Object.entries(STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
        </select>
        <span className="text-xs text-gray-500">{list.length} cadastros</span>
      </div>
      <div className="max-h-[560px] overflow-auto">
        <table className="text-sm">
          <thead><tr className="text-gray-400"><th className="text-left">Cadastro</th><th className="text-left">Campo</th><th className="text-left">ERP (atual)</th><th className="text-left">Fonte pública (sugerido)</th></tr></thead>
          <tbody>
            {list.slice(0, 400).map((r) => {
              const ds = (r.diffs || []).filter(inGroup);
              const head = (
                <td rowSpan={Math.max(ds.length, 1)} className="align-top">
                  <div className="text-white">{r.nm_pessoa}</div>
                  <div className="text-xs text-gray-500 font-mono">{fmtDoc(r.cnpj)} · {r.tipo} · #{r.cd_pessoa}</div>
                  <div className={`text-xs ${STATUS[r.status]?.cls}`}>{STATUS[r.status]?.label}{r.fonte ? ` · ${r.fonte}` : ""}{r.anonimizado ? " · anonimizado (LGPD)" : ""}</div>
                  {r.error && <div className="text-xs text-red-400">{r.error}</div>}
                </td>
              );
              if (!ds.length) return <tr key={r.cd_pessoa}>{head}<td colSpan={3} className="text-gray-600 text-xs">—</td></tr>;
              return ds.map((d, i) => (
                <tr key={`${r.cd_pessoa}-${d.field}`}>
                  {i === 0 && head}
                  <td className="text-gray-400 text-xs whitespace-nowrap">{d.label}</td>
                  <td className="text-red-300/90 text-xs">{d.erp || <i className="text-gray-600">vazio</i>}</td>
                  <td className="text-emerald-300 text-xs">{d.suggested}</td>
                </tr>
              ));
            })}
            {!list.length && <tr><td colSpan={4} className="text-center text-gray-600 py-6">Nenhum cadastro neste filtro</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}