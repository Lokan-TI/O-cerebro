import { fmtCur as fmtBRL } from "@/lib/erpFormat";

const STYLE = {
  queima: "border-red-500/40 bg-red-950/20 text-red-300",
  atencao: "border-amber-500/40 bg-amber-950/20 text-amber-300",
  saudavel: "border-emerald-500/40 bg-emerald-950/20 text-emerald-300",
  parado: "border-gray-700 bg-gray-900/40 text-gray-400",
  sem_valor: "border-blue-500/40 bg-blue-950/20 text-blue-300",
};

const LABEL = {
  queima: "Queima caixa",
  atencao: "Sob atenção",
  saudavel: "Saudável",
  parado: "Sem manutenção",
  sem_valor: "Sem valor no ERP",
};

export default function ManutencaoItemRow({ row }) {
  const razao = row.sem_valor || !isFinite(row.razao) ? "—" : `${(row.razao * 100).toFixed(0)}%`;
  return (
    <tr className="border-b border-gray-800/60 hover:bg-gray-900/40">
      <td className="py-2 pr-3">
        <div className="text-gray-100">{row.nm_equipto}</div>
        <div className="text-xs text-gray-500">
          {row.grupo} · {row.qtd_patrimonios} un. · vida útil {row.vida_util} anos
          {row.totalmente_depreciado && " · totalmente depreciado"}
        </div>
      </td>
      <td className="py-2 px-3 text-right text-gray-300">{fmtBRL(row.vl_aquisicao)}</td>
      <td className="py-2 px-3 text-right text-gray-300">
        {row.idade_media === null ? "—" : `${row.idade_media.toFixed(1)} a`}
      </td>
      <td className="py-2 px-3 text-right text-gray-300">{fmtBRL(row.depreciacao_anual)}</td>
      <td className="py-2 px-3 text-right text-gray-100">{fmtBRL(row.manutencao_12m)}</td>
      <td className="py-2 px-3 text-right text-gray-400">{row.qtd_os}</td>
      <td className="py-2 px-3 text-right font-medium">{razao}</td>
      <td className={`py-2 px-3 text-right font-medium ${row.excedente > 0 ? "text-red-300" : "text-gray-400"}`}>
        {row.sem_valor ? "—" : fmtBRL(row.excedente)}
      </td>
      <td className="py-2 pl-3 text-right">
        <span className={`inline-block border rounded-full px-2 py-0.5 text-xs ${STYLE[row.veredito]}`}>
          {LABEL[row.veredito]}
        </span>
      </td>
    </tr>
  );
}