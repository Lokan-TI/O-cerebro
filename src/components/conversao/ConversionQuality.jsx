import { fmtNum } from "@/lib/erpFormat";
import { CheckCircle2, Copy, AlertTriangle } from "lucide-react";

const pctTxt = (v) => (v == null ? "—" : `${v.toFixed(1)}%`);

export default function ConversionQuality({ duplicates, validations, clients }) {
  const inconsistentes = (clients || []).filter((c) => c.inconsistencias?.length > 0);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
          <Copy className="w-4 h-4 text-orange-400" /> Duplicidades — taxa bruta x saneada
        </h3>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-lg bg-gray-800/60 p-3">
            <div className="text-[10px] uppercase text-gray-500">IDs cadastrados</div>
            <div className="text-lg font-bold text-white">{fmtNum(duplicates?.ids_cadastrados)}</div>
          </div>
          <div className="rounded-lg bg-gray-800/60 p-3">
            <div className="text-[10px] uppercase text-gray-500">Clientes únicos estimados</div>
            <div className="text-lg font-bold text-white">{fmtNum(duplicates?.clientes_unicos_estimados)}</div>
          </div>
          <div className="rounded-lg bg-gray-800/60 p-3">
            <div className="text-[10px] uppercase text-gray-500">Taxa de conversão bruta</div>
            <div className="text-lg font-bold text-blue-400">{pctTxt(duplicates?.taxa_bruta)}</div>
          </div>
          <div className="rounded-lg bg-gray-800/60 p-3">
            <div className="text-[10px] uppercase text-gray-500">Taxa de conversão saneada</div>
            <div className="text-lg font-bold text-green-400">{pctTxt(duplicates?.taxa_saneada)}</div>
          </div>
        </div>
        <div className="text-xs text-gray-500 mb-2">
          {fmtNum(duplicates?.grupos_duplicados)} documentos repetidos · {fmtNum(duplicates?.ids_duplicados)} cadastros envolvidos
        </div>
        <div className="max-h-48 overflow-y-auto space-y-1">
          {(duplicates?.exemplos || []).map((d, i) => (
            <div key={i} className="flex items-center justify-between text-xs border-b border-gray-800/50 py-1.5">
              <span className="text-gray-400 font-mono">{d.doc}</span>
              <span className="text-gray-300 truncate max-w-[260px]">{(d.nomes || []).join(" · ")}</span>
              <span className="text-orange-400">{d.qtd}x</span>
            </div>
          ))}
          {(duplicates?.exemplos || []).length === 0 && <div className="text-gray-600 text-xs py-3">Nenhuma duplicidade por documento no período</div>}
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-400" /> Validações técnicas
        </h3>
        <div className="space-y-1 max-h-56 overflow-y-auto">
          {(validations || []).map((v, i) => (
            <div key={i} className="flex items-center justify-between text-xs border-b border-gray-800/50 py-1.5">
              <span className="text-gray-400">{v.item}</span>
              <span className="text-white font-medium">{fmtNum(v.valor)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 xl:col-span-2">
        <h3 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-purple-400" /> Registros com dados inconsistentes
          <span className="text-gray-500 font-normal">· {fmtNum(inconsistentes.length)} registros</span>
        </h3>
        <div className="overflow-x-auto max-h-72 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-900">
              <tr className="text-gray-500 uppercase border-b border-gray-800">
                <th className="text-left py-2 px-2">ID global</th>
                <th className="text-left py-2 px-2">Nome</th>
                <th className="text-left py-2 px-2">Cadastro</th>
                <th className="text-left py-2 px-2">1ª ficha</th>
                <th className="text-left py-2 px-2">1ª NF</th>
                <th className="text-left py-2 px-2">Inconsistências</th>
              </tr>
            </thead>
            <tbody>
              {inconsistentes.slice(0, 300).map((c) => (
                <tr key={c.gid} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="py-2 px-2 text-gray-500 font-mono">{c.gid}</td>
                  <td className="py-2 px-2 text-white max-w-[240px] truncate">{c.nome}</td>
                  <td className="py-2 px-2 text-gray-300">{c.dt_cad || "—"}</td>
                  <td className="py-2 px-2 text-gray-400">{c.dt_ficha || "—"}</td>
                  <td className="py-2 px-2 text-gray-400">{c.dt_nf || "—"}</td>
                  <td className="py-2 px-2 text-purple-300">{(c.inconsistencias || []).join(" · ")}</td>
                </tr>
              ))}
              {inconsistentes.length === 0 && <tr><td colSpan={6} className="text-center text-gray-600 py-6">Nenhuma inconsistência detectada</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}