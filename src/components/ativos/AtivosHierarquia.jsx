import { fmtCur, fmtNum } from "@/lib/erpFormat";
import { Boxes } from "lucide-react";

export default function AtivosHierarquia({ ranking }) {
  return (
    <div className="border border-gray-800 bg-gray-900/60 rounded-xl p-5">
      <h2 className="text-lg font-bold text-white flex items-center gap-2">
        <Boxes className="w-5 h-5 text-purple-400" /> Hierarquia completa de ativos
      </h2>
      <p className="text-sm text-gray-400 mt-1">
        Todos os ativos da empresa — patrimoniados e controlados por quantidade — ordenados pelo custo anual de posse
        (depreciação pela vida útil de referência + manutenção dos últimos 12 meses).
      </p>
      <div className="overflow-x-auto mt-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-800">
              <th className="py-2 pr-3">Família</th>
              <th className="py-2 pr-3 text-right">Patrimônios</th>
              <th className="py-2 pr-3 text-right">Peças em estoque</th>
              <th className="py-2 pr-3 text-right">Capital imobilizado</th>
              <th className="py-2 pr-3 text-right">Idade média</th>
              <th className="py-2 pr-3 text-right">Vida útil</th>
              <th className="py-2 pr-3 text-right">Depreciação/ano</th>
              <th className="py-2 pr-3 text-right">Manutenção 12m</th>
              <th className="py-2 pr-3 text-right">Manut. % ativo</th>
              <th className="py-2 pr-3 text-right">Custo de posse/ano</th>
              <th className="py-2 text-right">CAPEX 12m</th>
            </tr>
          </thead>
          <tbody>
            {ranking.map((r) => (
              <tr key={r.grupo} className="border-b border-gray-800/60 hover:bg-gray-800/30">
                <td className="py-2 pr-3 text-white">{r.grupo}</td>
                <td className="py-2 pr-3 text-right text-gray-300">{r.patrimonios ? fmtNum(r.patrimonios) : "—"}</td>
                <td className="py-2 pr-3 text-right text-gray-300">{r.qt_estoque ? fmtNum(r.qt_estoque) : "—"}</td>
                <td className="py-2 pr-3 text-right text-white">{fmtCur(r.vl_total)}</td>
                <td className="py-2 pr-3 text-right text-gray-300">{r.idade_media ? `${r.idade_media.toFixed(1)} a` : "—"}</td>
                <td className="py-2 pr-3 text-right text-gray-500">{r.vida_util} a</td>
                <td className="py-2 pr-3 text-right text-amber-300">{fmtCur(r.depreciacao)}</td>
                <td className="py-2 pr-3 text-right text-orange-300">{fmtCur(r.manutencao_12m)}</td>
                <td className={`py-2 pr-3 text-right ${r.manut_pct > 8 ? "text-red-400" : r.manut_pct > 4 ? "text-amber-300" : "text-emerald-400"}`}>
                  {r.manut_pct.toFixed(1)}%
                </td>
                <td className="py-2 pr-3 text-right text-purple-300 font-semibold">{fmtCur(r.custo_posse)}</td>
                <td className="py-2 text-right text-gray-300">{r.capex_12m ? fmtCur(r.capex_12m) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}