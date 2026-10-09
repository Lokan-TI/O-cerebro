// Tabela detalhada exibida apenas no PDF da Visão Executiva (oculta na tela).
export const fmtShort = (v) => {
  const n = Number(v) || 0;
  const a = Math.abs(n);
  if (a >= 1e6) return `${(n / 1e6).toFixed(1).replace(".", ",")} mi`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(0)} mil`;
  return n.toFixed(0);
};

export default function PdfDataTable({ columns, rows }) {
  return (
    <div data-pdf-show className="hidden mt-4">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-400">
            {columns.map((c, i) => (
              <th key={c.label} className={i === 0 ? "text-left" : "text-right"}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>
              {columns.map((c, i) => (
                <td key={c.label} className={i === 0 ? "text-left text-white" : "text-right text-gray-300"}>{c.render(r)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}