import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { ALL_SOURCES_ID } from "@/lib/ErpSourceContext";

// Faturamento por geração de faturas de locação (fl_fatura.dt_geracao), por mês e empresa.
export default function useFaturasLocacao(sourceId, period) {
  const [state, setState] = useState({ rows: null, error: null });
  useEffect(() => {
    let alive = true;
    setState({ rows: null, error: null });
    (async () => {
      const ids = sourceId && sourceId !== ALL_SOURCES_ID
        ? [sourceId]
        : (await base44.entities.ErpDataSource.filter({ is_active: true })).map((s) => s.id);
      const all = [];
      for (const id of ids) {
        const res = await base44.functions.invoke("listContratosAbertos", { source_id: id, mode: "faturas_mensal", start: period.start, end: period.end });
        if (res.data?.error) throw new Error(res.data.error);
        all.push(...res.data.rows);
      }
      if (alive) setState({ rows: all, error: null });
    })().catch((e) => alive && setState({ rows: null, error: e.response?.data?.error || e.message }));
    return () => { alive = false; };
  }, [sourceId, period.start, period.end]);
  return state;
}