import { fmtData, fmtFicha } from "./padraoApi";
import FichaMovimentacao from "./FichaMovimentacao";

export default function PadraoFichasAtivas({ fichas, equipamentos }) {
  // "Aberta" = locação (não orçamento) sem encerramento — regra do ciclo de vida da ficha.
  const ativas = fichas.filter((f) => !f.dt_enc_ficha && f.tp_ope_pedido !== "O");
  if (!ativas.length) return <div className="text-gray-500 text-sm">Nenhuma ficha ativa.</div>;
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
      {ativas.map((f) => {
        const eqs = equipamentos.filter((e) => e.cd_controle === f.cd_controle);
        return (
          <div key={f.cd_controle} className="rounded-lg border border-gray-800 bg-gray-950/50 p-3 text-xs space-y-1">
            <div className="text-white font-semibold text-sm">Ficha {fmtFicha(f.numero_ficha)} <span className="text-[10px] font-normal text-gray-600">cód. {f.cd_controle}</span>{f.tp_ope_pedido === "O" && <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">Orçamento</span>}</div>
            <div className="text-gray-400">Abertura: {fmtData(f.dt_pedido)}</div>
            <div className="text-gray-400">Período: {fmtData(f.dt_fai_ficha)} → {fmtData(f.dt_faf_ficha)}</div>
            <div className="text-purple-300">Saldo no cliente: {f.saldo_no_cliente ?? 0}</div>
            {eqs.length > 0 && <div className="text-gray-500 truncate" title={eqs.map((e) => e.ds_descricaocomercial || e.nm_grupo).join(", ")}>{eqs.map((e) => e.ds_descricaocomercial || e.nm_grupo).join(", ")}</div>}
            <FichaMovimentacao cdControle={f.cd_controle} />
          </div>
        );
      })}
    </div>
  );
}