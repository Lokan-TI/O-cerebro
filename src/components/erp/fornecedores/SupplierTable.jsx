import { fmtCur, fmtDoc } from "@/lib/erpFormat";
import { Pencil } from "lucide-react";

const COLS = [
  ["nm_fan_pessoa", "Nome fantasia"], ["nm_pessoa", "Razão social"], ["cnpj", "CNPJ/CPF"], ["cep", "CEP"],
  ["logradouro", "Endereço"], ["numero", "Número"], ["complemento", "Complemento"], ["bairro", "Bairro"],
  ["cidade", "Cidade"], ["uf", "UF"], ["codigo_ibge", "Código IBGE"], ["telefone", "Telefone"], ["email", "E-mail"],
];
const PUB = { ok: ["Encontrado", "text-emerald-400"], not_found: ["Não encontrado", "text-amber-400"], error: ["Erro", "text-red-400"] };

export default function SupplierTable({ rows, onEdit }) {
  const val = (r, k) => (k === "cnpj" ? fmtDoc(r.cnpj) || fmtDoc(r.cpf) : r[k]) || "—";
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-gray-500">
          <th className="text-left">Código</th>
          {COLS.map(([k, l]) => <th key={k} className="text-left">{l}</th>)}
          <th className="text-left">Fonte pública</th>
          <th className="text-right">Consumo (CAP)</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const p = PUB[r._pubStatus];
          return (
            <tr key={r.cd_pessoa}>
              <td className="text-gray-500">{r.cd_pessoa}</td>
              {COLS.map(([k]) => <td key={k} className="text-gray-200 whitespace-nowrap">{val(r, k)}</td>)}
              <td className={`whitespace-nowrap ${p?.[1] || "text-gray-600"}`} title={r._pubError}>{p?.[0] || "Não consultado"}</td>
              <td className="text-right text-red-400 whitespace-nowrap">{fmtCur(r.cap_total)}</td>
              <td><button onClick={() => onEdit(r)} className="text-gray-500 hover:text-purple-400"><Pencil className="w-3.5 h-3.5" /></button></td>
            </tr>
          );
        })}
        {rows.length === 0 && <tr><td colSpan={COLS.length + 4} className="text-center text-gray-600 py-6">Nenhum fornecedor encontrado</td></tr>}
      </tbody>
    </table>
  );
}