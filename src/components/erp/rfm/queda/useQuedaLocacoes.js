import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { enrich } from "./quedaCalc";

const errMsg = (e) => {
  const m = e?.response?.data?.error || e?.message || "Falha na consulta.";
  return typeof m === "string" ? m : (m.message || JSON.stringify(m));
};

export function fetchDetalhes(params, ids) {
  return base44.functions.invoke("analyzeQuedaLocacoes", { ...params, mode: "detalhes", cd_pessoas: ids })
    .then((r) => r.data)
    .catch((e) => { throw new Error(errMsg(e)); });
}

export default function useQuedaLocacoes() {
  const [state, setState] = useState({ loading: false, error: null, data: null, params: null });
  const run = async (params) => {
    setState({ loading: true, error: null, data: null, params });
    try {
      const { data } = await base44.functions.invoke("analyzeQuedaLocacoes", params);
      if (!data || !Array.isArray(data.clientes)) throw new Error(data?.error || "A consulta não retornou dados válidos. Tente um período menor.");
      const clientes = data.clientes.map((c) => enrich({ ...c, nome: String(c.nome || ""), doc: String(c.doc || ""), cd_pessoa: String(c.cd_pessoa) }));
      setState({ loading: false, error: null, params, data: { ...data, clientes } });
    } catch (e) {
      setState({ loading: false, error: errMsg(e), data: null, params });
    }
  };
  return { ...state, run };
}