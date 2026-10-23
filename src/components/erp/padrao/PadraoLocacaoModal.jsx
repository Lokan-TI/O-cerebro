import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fmtCur } from "@/lib/erpFormat";
import { fetchPadraoDetalhe } from "./padraoApi";
import { useEmpresaFilter } from "@/lib/EmpresaFilterContext";
import PadraoHeatmap from "./PadraoHeatmap";
import PadraoFichasChart from "./PadraoFichasChart";
import PadraoCiclo from "./PadraoCiclo";
import PadraoGrupos from "./PadraoGrupos";
import PadraoFichasAtivas from "./PadraoFichasAtivas";

const Sec = ({ title, children }) => (
  <div className="space-y-2"><h4 className="text-white text-sm font-semibold">{title}</h4>{children}</div>
);

export default function PadraoLocacaoModal({ client, padrao, onClose }) {
  const { selectedEmpresa } = useEmpresaFilter();
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    fetchPadraoDetalhe(client.cd_pessoa, selectedEmpresa).then(setD).catch((e) => setError(e?.response?.data?.error || e.message));
  }, [client.cd_pessoa, selectedEmpresa]);
  const captador = d?.fichas?.find((f) => f.nm_captador)?.nm_captador;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent translate="no" className="notranslate max-w-5xl max-h-[90vh] overflow-y-auto bg-gray-900 border-gray-800 text-white">
        <DialogHeader>
          <DialogTitle>{client.nm_pessoa} <span className="text-gray-500 text-sm">{client.cd_pessoa}</span></DialogTitle>
          <div className="text-sm text-gray-400">
            Faturamento 12m: <span className="text-green-400">{fmtCur(padrao?.vl_faturamento_12m ?? client.receita ?? 0)}</span>
            {" · "}Captador: <span className="text-gray-200">{d ? captador || "—" : "…"}</span>
          </div>
        </DialogHeader>
        {error && <div className="text-red-300 text-sm">{error}</div>}
        {!d && !error && <div className="text-gray-500 py-10 text-center">Carregando padrão de locação…</div>}
        {d && (
          <div className="space-y-5">
            <PadraoCiclo p={padrao} />
            <Sec title="Fichas ativas"><PadraoFichasAtivas fichas={d.fichas} equipamentos={d.equipamentos_ativos} /></Sec>
            <Sec title="Mapa de calor — fichas por mês (36 meses)"><PadraoHeatmap data={d.heatmap_mensal} /></Sec>
            <Sec title="Fichas por mês"><PadraoFichasChart data={d.heatmap_mensal} /></Sec>
            <Sec title="Grupos de equipamentos mais locados"><PadraoGrupos grupos={d.grupos_mais_locados} /></Sec>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}