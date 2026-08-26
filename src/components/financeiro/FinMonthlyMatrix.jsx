import { fmtCur } from "@/lib/erpFormat";
import { sortMonthly } from "@/lib/finMonthParse";

// Matriz operação x mês (rodapé analítico do dashboard de referência)
export default function FinMonthlyMatrix({ rows: rawRows = [] }) {
  const rows = sortMonthly(rawRows);
  const months = rows.map((r) => r.label);
  const lines = [
    { key: "car", label: "Contas a Receber (CAR)", cls: "text-green-400" },
    { key: "car_baixado", label: "Recebido (baixas CAR)", cls: "text-emerald-300" },
    { key: "cap", label: "Contas a Pagar (CAP)", cls: "text-red-400" },
    { key: "cap_baixado", label: "Pago (baixas CAP)", cls: "text-orange-300" },
  ];

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 overflow-x-auto">
      <h3 className="text-white font-semibold text-sm mb-4">Movimentação por mês</h3>
      <table className="w-full text-sm min-w-[720px]">
        <thead>
          <tr className="text-gray-500 text-xs uppercase border-b border-gray-800">
            <th className="text-left py-2 px-3">Operação</th>
            {months.map((m) => <th key={m} className="text-right py-2 px-3">{m}</th>)}
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.key} className="border-b border-gray-800/50 hover:bg-gray-800/30">
              <td className="py-2 px-3 text-gray-300">{l.label}</td>
              {rows.map((r, i) => (
                <td key={i} className={`py-2 px-3 text-right ${l.cls}`}>{fmtCur(r[l.key] || 0)}</td>
              ))}
            </tr>
          ))}
          <tr className="border-t border-gray-700 bg-gray-800/40 font-semibold">
            <td className="py-2 px-3 text-white">Saldo (CAR − CAP)</td>
            {rows.map((r, i) => {
              const s = (r.car || 0) - (r.cap || 0);
              return <td key={i} className={`py-2 px-3 text-right ${s >= 0 ? "text-white" : "text-red-400"}`}>{fmtCur(s)}</td>;
            })}
          </tr>
          {rows.length === 0 && <tr><td className="text-center text-gray-600 py-6">Sem dados mensais</td></tr>}
        </tbody>
      </table>
    </div>
  );
}