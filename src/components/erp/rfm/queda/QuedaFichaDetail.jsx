import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { getDetalhe } from "./detailCache";
import { fmtD } from "./quedaCalc";

const brl = (v) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function QuedaFichaDetail({ params, cdPessoa }) {
  const [st, setSt] = useState({ loading: true });
  const [tries, setTries] = useState(0);
  useEffect(() => {
    let alive = true;
    setSt({ loading: true });
    getDetalhe(params, cdPessoa)
      .then((d) => alive && setSt({ data: d }))
      .catch((e) => alive && setSt({ error: e.message }));
    return () => { alive = false; };
  }, [JSON.stringify(params), cdPessoa, tries]);

  if (st.loading) return <p className="flex items-center gap-2 text-xs text-gray-400 py-3"><Loader2 className="w-3 h-3 animate-spin" /> Carregando fichas…</p>;
  if (st.error) return <p className="text-xs text-red-400 py-3">{st.error} <button onClick={() => setTries(tries + 1)} className="ml-2 underline text-violet-300">Tentar novamente</button></p>;
  const { fichas, orcamentos } = st.data;
  const orc = orcamentos[0];
  return (
    <div className="space-y-2 py-2">
      <p className="text-xs text-gray-400">
        Último orçamento: <b className="text-gray-200">{orc ? `${orc.numero} em ${fmtD(orc.data)}` : "nenhum registrado"}</b>
        {orc && <> · Equipamentos cotados: <span className="text-gray-300">{orc.equipamentos || "não informados no orçamento"}</span></>}
      </p>
      {fichas.length === 0 && <p className="text-xs text-gray-500">Nenhuma ficha fechada nos dois períodos.</p>}
      {fichas.map((f) => (
        <div key={f.cd_controle} className="rounded-md border border-gray-800 bg-gray-950/60 p-2.5 text-xs">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-gray-300">
            <b className="text-white">Ficha {f.numero}</b>
            <span>Período {f.periodo}</span><span>Início {fmtD(f.inicio)}</span>
            <span><b className="text-violet-300">{f.renovacoes}</b> renovações</span>
            <span>{f.encerrada ? `Encerrada ${fmtD(f.encerrada)}` : "Em aberto"}</span>
            <span>Valor total <b className="text-emerald-300">{brl(f.valor_total)}</b>
              <span className="text-gray-500"> (contrato e renovações {brl(f.valor_renovacoes)} + à parte {brl(f.valor_complementar)})</span></span>
          </div>
          {f.movimentacoes.length > 0 && <p className="text-gray-500 mt-1">Movimentações: {f.movimentacoes.map((m) => m.split("→").map(fmtD).join(" a ")).join(" · ")}</p>}
          <p className="text-gray-400 mt-1">
            Equipamentos: {f.equipamentos.length ? f.equipamentos.map((e) => `${e.nome} (${e.qt}${e.em_cliente ? `, ${e.em_cliente} ainda no cliente` : ""})`).join("; ") : "sem remessa registrada"}
          </p>
        </div>
      ))}
    </div>
  );
}