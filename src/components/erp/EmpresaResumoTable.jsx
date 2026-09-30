import { getEmpresaLabel } from "@/lib/empresaLabels";

const brl = (v) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

// Totais por empresa calculados a partir dos mesmos clientes filtrados que vão para o Excel
export default function EmpresaResumoTable({ clients = [] }) {
  const map = new Map();
  for (const c of clients) {
    const k = String(c.cd_empresa ?? "");
    const e = map.get(k) || { cd_empresa: c.cd_empresa, empresa_nome: c.empresa_nome, clientes: 0, ativos: 0, faturamento: 0, car_aberto: 0, car_vencido: 0 };
    e.clientes++;
    if (c.status === "ATIVO") e.ativos++;
    e.faturamento += Number(c.faturamento) || 0;
    e.car_aberto += Number(c.car_aberto) || 0;
    e.car_vencido += Number(c.car_vencido) || 0;
    map.set(k, e);
  }
  const rows = [...map.values()].sort((a, b) => b.faturamento - a.faturamento);
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-gray-800/50 text-gray-400 text-xs uppercase tracking-wide">
          <th className="text-left px-4 py-2">Empresa</th>
          <th className="text-center px-4 py-2">Clientes</th>
          <th className="text-center px-4 py-2">Ativos</th>
          <th className="text-right px-4 py-2">Faturamento</th>
          <th className="text-right px-4 py-2">CAR aberto</th>
          <th className="text-right px-4 py-2">CAR vencido</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((e) => (
          <tr key={String(e.cd_empresa)} className="border-t border-gray-800">
            <td className="px-4 py-2 text-white">{e.cd_empresa == null ? "Sem empresa" : getEmpresaLabel(e.cd_empresa, e.empresa_nome)}</td>
            <td className="px-4 py-2 text-center text-gray-300">{e.clientes}</td>
            <td className="px-4 py-2 text-center text-green-400">{e.ativos}</td>
            <td className="px-4 py-2 text-right text-white">{brl(e.faturamento)}</td>
            <td className="px-4 py-2 text-right text-purple-300">{brl(e.car_aberto)}</td>
            <td className="px-4 py-2 text-right text-amber-400">{brl(e.car_vencido)}</td>
          </tr>
        ))}
        {!rows.length && <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500 text-xs">Nenhum cliente com os filtros selecionados.</td></tr>}
      </tbody>
    </table>
  );
}