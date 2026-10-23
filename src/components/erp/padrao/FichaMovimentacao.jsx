import { useState } from "react";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useErpSource, ALL_SOURCES_ID } from "@/lib/ErpSourceContext";
import { fmtData } from "./padraoApi";

const brl = (v) => (v == null ? "" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));

export default function FichaMovimentacao({ cdControle }) {
  const { selectedSource } = useErpSource();
  const [st, setSt] = useState({ open: false, loading: false, data: null, error: null });
  const load = async () => {
    if (st.open) return setSt((s) => ({ ...s, open: false }));
    setSt({ open: true, loading: true, data: null, error: null });
    const payload = { cd_controle: cdControle };
    if (selectedSource?.id && selectedSource.id !== ALL_SOURCES_ID) payload.source_id = selectedSource.id;
    const r = await base44.functions.invoke("listMovimentacaoFicha", payload).catch((e) => ({ data: { error: e.response?.data?.error || e.message } }));
    setSt({ open: true, loading: false, data: r.data?.error ? null : r.data, error: r.data?.error || null });
  };
  return (
    <div>
      <button onClick={load} className="text-[11px] text-purple-300 underline">{st.open ? "Ocultar movimentação" : "Movimentação"}</button>
      {st.open && (
        <div className="mt-2 space-y-2">
          {st.loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}
          {st.error && <p className="text-red-400">{st.error}</p>}
          {st.data && (
            <>
              <p className="text-gray-400">{st.data.ficha.ficha_status_detalhe} · saldo real: <b className="text-purple-300">{st.data.saldo_total}</b></p>
              <div className="max-h-56 overflow-y-auto">
                <table className="text-[11px]"><thead><tr><th>Descrição</th><th>Nº</th><th>Data</th><th>NF</th><th className="text-right">Valor</th></tr></thead>
                  <tbody>{st.data.timeline.map((t, i) => (
                    <tr key={i} title={t.itens.map((x) => `${x.qt}× ${x.nome}`).join(", ")}>
                      <td className="text-gray-200">{t.descricao}{t.periodo ? ` (${t.periodo.split(" → ").map(fmtData).join(" → ")})` : t.itens.length ? ` · ${t.itens.length} itens` : ""}</td>
                      <td className="text-gray-400">{t.numero}</td><td className="text-gray-400">{fmtData(t.data)}</td>
                      <td className="text-gray-400">{t.nr_nf || t.cd_nf || ""}</td><td className="text-right text-gray-300">{brl(t.valor)}</td>
                    </tr>))}</tbody></table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}