import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { enrich } from "./quedaCalc";

const errMsg = (e) => e?.response?.data?.error || e?.message || "Falha na consulta.";

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
      setState({ loading: false, error: null, params, data: { ...data, clientes: (data.clientes || []).map(enrich) } });
    } catch (e) {
      setState({ loading: false, error: errMsg(e), data: null, params });
    }
  };
  return { ...state, run };
}