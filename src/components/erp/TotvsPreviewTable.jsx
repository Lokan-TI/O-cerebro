export default function TotvsPreviewTable({ columns, rows }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="text-xs text-gray-400 mb-3">
        {rows.length.toLocaleString("pt-BR")} linhas carregadas — prévia das 20 primeiras
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-500 border-b border-gray-800">
              {columns.map((c) => (
                <th key={c.id} className="text-left py-2 px-2 whitespace-nowrap" title={c.label}>{c.id}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 20).map((r, i) => (
              <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                {columns.map((c) => (
                  <td key={c.id} className={`py-1.5 px-2 whitespace-nowrap max-w-[200px] truncate ${c.id === "SANEAMENTO" && r[c.id] ? "text-amber-300" : "text-gray-300"}`}>
                    {r[c.id] == null || r[c.id] === "" ? "—" : String(r[c.id])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}