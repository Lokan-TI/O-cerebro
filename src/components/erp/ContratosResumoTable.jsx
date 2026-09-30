const fmt = (c, v) => typeof v !== "number" ? v
  : c.startsWith("Vl.") ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
  : v.toLocaleString("pt-BR");

export default function ContratosResumoTable({ linhas }) {
  if (!linhas?.length) return null;
  const cols = Object.keys(linhas[0]);
  return (
    <div className="px-4 py-3 border-b border-gray-800 overflow-x-auto">
      <p className="text-gray-300 text-xs font-medium mb-2">Resumo — Fichas de Locação (status Aberta)</p>
      <table className="text-xs text-gray-200">
        <thead><tr>{cols.map((c) => <th key={c} className="text-left text-gray-400">{c}</th>)}</tr></thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={i} className={l.Empresa === "TOTAL" ? "font-semibold text-white" : ""}>
              {cols.map((c) => <td key={c} className={typeof l[c] === "number" ? "text-right" : ""}>{fmt(c, l[c])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}