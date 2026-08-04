import { fmtCurrency, fmtNumber, fmtPercent } from "./AnalyticsKpiCard";

const FINANCIAL_ROWS = [
  { key: "fat_ano", label: "Receita Anual", fmt: "currency", best: "max" },
  { key: "fat_ano_ant", label: "Receita Ano Anterior", fmt: "currency", best: "max" },
  { key: "crescimento_ano", label: "Crescimento Anual", fmt: "percent", best: "max" },
  { key: "fat_mes", label: "Receita Mensal", fmt: "currency", best: "max" },
  { key: "crescimento_mes", label: "Crescimento Mensal", fmt: "percent", best: "max" },
  { key: "ticket_ano", label: "Ticket Médio Anual", fmt: "currency", best: "max" },
  { key: "nfs_ano", label: "NFs Emitidas (Ano)", fmt: "number", best: "max" },
  { key: "nfs_mes", label: "NFs Emitidas (Mês)", fmt: "number", best: "max" },
];

const COMMERCIAL_ROWS = [
  { key: "clientes_ano", label: "Clientes Ativos (Ano)", fmt: "number", best: "max" },
  { key: "clientes_mes", label: "Clientes Ativos (Mês)", fmt: "number", best: "max" },
  { key: "receita_por_cliente", label: "Receita por Cliente", fmt: "currency", best: "max" },
  { key: "fat_ano", label: "Receita Total", fmt: "currency", best: "max" },
  { key: "nfs_ano", label: "Volume de Notas Fiscais", fmt: "number", best: "max" },
  { key: "ticket_ano", label: "Ticket Médio", fmt: "currency", best: "max" },
];

function fmtValue(v, fmt) {
  if (v == null) return "—";
  if (fmt === "currency") return fmtCurrency(v);
  if (fmt === "percent") return fmtPercent(v);
  return fmtNumber(v);
}

export default function EmpresaComparisonTable({ empresas, mode }) {
  const rows = mode === "financeiro" ? FINANCIAL_ROWS : COMMERCIAL_ROWS;

  const bestValues = {};
  for (const row of rows) {
    if (row.best === "max") {
      let max = -Infinity;
      for (const emp of empresas) {
        const v = emp[row.key];
        if (v != null && v > max) max = v;
      }
      bestValues[row.key] = max;
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b-2 border-gray-700">
            <th className="text-left text-gray-400 font-medium px-3 py-3 sticky left-0 bg-gray-900 z-10 min-w-[180px]">KPI</th>
            {empresas.map(emp => (
              <th key={emp.cd_empresa} className="text-right text-gray-200 font-medium px-3 py-3 min-w-[150px] align-top">
                <div className="truncate max-w-[140px]" title={emp.nm_empresa}>{emp.nm_empresa}</div>
                <div className="text-xs text-gray-500 font-normal mt-0.5">Cod. {emp.cd_empresa}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.key} className={`border-b border-gray-800 ${i % 2 === 0 ? "bg-gray-900/40" : ""}`}>
              <td className="text-gray-400 px-3 py-2.5 font-medium sticky left-0 bg-gray-900 z-10">{row.label}</td>
              {empresas.map(emp => {
                const v = emp[row.key];
                const isBest = row.best === "max" && v != null && v === bestValues[row.key] && v > 0;
                return (
                  <td key={emp.cd_empresa} className={`text-right px-3 py-2.5 tabular-nums whitespace-nowrap ${isBest ? "text-green-400 font-bold" : "text-gray-200"}`}>
                    {fmtValue(v, row.fmt)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}