import { fmtNum } from "@/lib/erpFormat";

function OptionsList({ options }) {
  const parts = String(options)
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean);
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {parts.map((p, i) => (
        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-950/50 text-indigo-300 border border-indigo-800/40">
          {p}
        </span>
      ))}
    </div>
  );
}

export default function DicionarioColunas({ items, showTable = false, onSelectTable }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-500 text-xs uppercase border-b border-gray-800">
            {showTable && <th className="text-left py-2 px-3">Tabela</th>}
            <th className="text-left py-2 px-3">Campo</th>
            <th className="text-left py-2 px-3">Descrição / domínio</th>
            <th className="text-left py-2 px-3">Tipo</th>
            <th className="text-center py-2 px-3">Nulo</th>
            <th className="text-left py-2 px-3">Chave estrangeira</th>
          </tr>
        </thead>
        <tbody>
          {items.map((c, i) => (
            <tr key={`${c.tabela}.${c.coluna}-${i}`} className="border-b border-gray-800/50 hover:bg-gray-800/30 align-top">
              {showTable && (
                <td className="py-2 px-3">
                  <button onClick={() => onSelectTable?.(c.tabela)} className="text-purple-300 hover:text-purple-200 font-mono text-xs">
                    {c.tabela}
                  </button>
                </td>
              )}
              <td className="py-2 px-3 text-white font-mono text-xs whitespace-nowrap">{c.coluna}</td>
              <td className="py-2 px-3 text-gray-300 max-w-md">
                {c.caption || <span className="text-gray-600">—</span>}
                {c.options ? <OptionsList options={c.options} /> : null}
              </td>
              <td className="py-2 px-3 text-gray-400 text-xs whitespace-nowrap">
                {c.tipo}
                {c.tamanho ? <span className="text-gray-600"> ({fmtNum(c.tamanho)})</span> : null}
              </td>
              <td className="py-2 px-3 text-center text-xs">
                {c.nulo === "N" ? <span className="text-amber-400">obrig.</span> : <span className="text-gray-600">sim</span>}
              </td>
              <td className="py-2 px-3 text-xs font-mono">
                {c.fk ? (
                  <button onClick={() => onSelectTable?.(c.fk.split(".")[0])} className="text-emerald-400 hover:text-emerald-300">
                    {c.fk}
                  </button>
                ) : (
                  <span className="text-gray-700">—</span>
                )}
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr><td colSpan={showTable ? 6 : 5} className="text-center text-gray-600 py-6">Nenhum campo encontrado</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}