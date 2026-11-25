import { useEffect, useState } from "react";
import { invokeFichasStatus } from "@/components/erp/fichasStatusApi";

// Total de fichas de locação por status, em todas as datas — a mesma contagem da tela "Ficha de Locação" do Sisloc.
export default function useFichasResumo(sourceId, selectedEmpresa) {
  const [state, setState] = useState({ resumo: null, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setState({ resumo: null, error: null });
    const payload = { mode: "resumo" };
    if (sourceId) payload.source_id = sourceId;
    if (selectedEmpresa != null) payload.cd_empresa = selectedEmpresa;
    invokeFichasStatus(payload)
      .then((data) => {
        if (!alive) return;
        const counts = Object.fromEntries(Object.entries(data.counts).map(([status, n]) => [`fichas_${status}`, n]));
        setState({ resumo: { fichas: data.fichas, clientes: data.clientes, counts }, error: null });
      })
      .catch((e) => alive && setState({ resumo: null, error: e?.response?.data?.error || e.message }));
    return () => { alive = false; };
  }, [sourceId, selectedEmpresa, attempt]);

  return { ...state, retry: () => setAttempt((n) => n + 1) };
}