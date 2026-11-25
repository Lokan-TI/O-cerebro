import { FICHA_STATUS } from "@/components/erp/FichaStatusFilter";
import { fichaStatusLabel } from "@/components/erp/fichasStatusExport";
import { fmtData, fmtFicha } from "@/components/erp/padrao/padraoApi";

const dot = (status) => FICHA_STATUS.find((s) => s.id === `fichas_${status}`)?.dot || "bg-gray-500";

// Uma linha por ficha de locação, com o cliente e o contato informado na ficha.
export default function FichasStatusTable({ rows }) {
  return (
    <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-gray-900">
          <tr className="text-gray-500 text-xs uppercase border-b border-gray-800">
            <th className="text-left py-2 px-3">Ficha</th>
            <th className="text-left py-2 px-3">Status</th>
            <th className="text-right py-2 px-3">Pedido</th>
            <th className="text-right py-2 px-3">Validade</th>
            <th className="text-right py-2 px-3">Encerramento</th>
            <th className="text-left py-2 px-3">Cliente</th>
            <th className="text-left py-2 px-3">Empresa Sisloc</th>
            <th className="text-left py-2 px-3">Contato</th>
            <th className="text-left py-2 px-3">Telefone</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((f) => (
            <tr key={f.cd_controle} className="border-b border-gray-800/50">
              <td className="py-2 px-3 text-gray-300 font-mono text-xs">{fmtFicha(f.numero)}</td>
              <td className="py-2 px-3 text-gray-200 text-xs whitespace-nowrap">
                <span className={`inline-block w-2 h-2 rounded-sm mr-1.5 ${dot(f.status)}`} />{fichaStatusLabel(f.status)}
              </td>
              <td className="py-2 px-3 text-right text-gray-400 text-xs">{fmtData(f.dt_pedido)}</td>
              <td className="py-2 px-3 text-right text-gray-400 text-xs">{fmtData(f.dt_validade)}</td>
              <td className="py-2 px-3 text-right text-gray-400 text-xs">{fmtData(f.dt_enc_ficha)}</td>
              <td className="py-2 px-3 text-white">
                <div className="truncate max-w-[260px]">{f.nm_pessoa}</div>
                <div className="text-xs text-gray-600">{f.cd_pessoa}</div>
              </td>
              <td className="py-2 px-3 text-gray-300 text-xs"><div className="truncate max-w-[200px]">{f.nm_empresa}</div></td>
              <td className="py-2 px-3 text-gray-300 text-xs"><div className="truncate max-w-[180px]">{f.contato || "—"}</div></td>
              <td className="py-2 px-3 text-gray-300 text-xs whitespace-nowrap">{f.telefone || "—"}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={9} className="text-center text-gray-600 py-6">Nenhuma ficha encontrada</td></tr>}
        </tbody>
      </table>
    </div>
  );
}