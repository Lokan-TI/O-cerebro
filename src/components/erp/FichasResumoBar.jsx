import FichaStatusFilter from "@/components/erp/FichaStatusFilter";
import { fmtNum } from "@/lib/erpFormat";

// Fichas de locação por status, em todas as datas — a mesma contagem da tela "Ficha de Locação" do Sisloc.
// Marcar um status lista as fichas dele; `onShowAll` (fora da lista de fichas) abre todas.
export default function FichasResumoBar({ resumo, error, onRetry, value, onChange, onShowAll }) {
  return (
    <div className="space-y-2">
      <FichaStatusFilter value={value} onChange={onChange} counts={resumo?.counts} />
      {error ? (
        <div className="text-xs text-red-300">
          Não foi possível contar as fichas no Sisloc: {error}{" "}
          <button type="button" onClick={onRetry} className="underline hover:text-white">Tentar novamente</button>
        </div>
      ) : (
        <div className="text-xs text-gray-500">
          {resumo ? (
            <>
              <span className="text-gray-200 font-medium">{fmtNum(resumo.fichas)} fichas de locação</span> de {fmtNum(resumo.clientes)} clientes,
              em todas as datas — a mesma contagem da tela Ficha de Locação do Sisloc.
            </>
          ) : "Contando as fichas de locação no Sisloc… pode levar um pouco enquanto a tela carrega."}
          {onShowAll && (
            <>
              {" "}Marque um status para listar as fichas ou{" "}
              <button type="button" onClick={onShowAll} className="text-purple-400 hover:text-purple-300 underline">veja todas</button>.
            </>
          )}
        </div>
      )}
    </div>
  );
}