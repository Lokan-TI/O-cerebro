import { fmtNum } from "@/lib/erpFormat";

export default function PadraoGrupos({ grupos }) {
  if (!grupos.length) return <div className="text-gray-500 text-sm">Nenhum grupo encontrado.</div>;
  return (
    <div className="max-h-64 overflow-y-auto">
      <table className="text-sm">
        <thead><tr><th className="text-left">Grupo</th><th className="text-right">Itens enviados</th><th className="text-right">Saldo atual</th></tr></thead>
        <tbody>
          {grupos.map((g) => (
            <tr key={g.cd_grupo}>
              <td className="text-white">{g.nm_grupo}</td>
              <td className="text-right text-gray-300">{fmtNum(g.itens_enviados)}</td>
              <td className="text-right text-purple-300">{fmtNum(g.saldo_atual)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}