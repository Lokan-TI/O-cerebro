import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { toExclusiveEnd } from "@/lib/periodContract";

// Dados da análise de CAR com cache local: mostra na hora o último resultado salvo
// para a mesma fonte/período e atualiza em segundo plano (consultas em sequência).
const PREFIX = "car-dados-v1:";
const read = (key) => { try { return JSON.parse(localStorage.getItem(PREFIX + key)); } catch { return null; } };
const write = (key, val) => {
  try { localStorage.setItem(PREFIX + key, JSON.stringify(val)); }
  catch { Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).forEach((k) => localStorage.removeItem(k)); }
};

async function call(fn, payload) {
  const res = await base44.functions.invoke(fn, payload);
  if (!res?.data?.success) throw new Error(res?.data?.error || "Falha na consulta");
  return res.data;
}

export default function useCarDados({ sourceId, start, end }) {
  const key = `${sourceId || "env"}|${start}|${end}`;
  const [data, setData] = useState(() => read(key));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const carregar = useCallback(async () => {
    setLoading(true); setError(null);
    const payload = { source_id: sourceId, start_date: start, end_date: end, end_date_exclusive: toExclusiveEnd(end) };
    try {
      const a = await call("listCarAnalise", payload);
      setData((d) => ({ ...(d || {}), rows: a.rows || [] }));
      const r = await call("listCarRecuperacao", payload);
      const next = { rows: a.rows || [], curvas: r.curvas || [], titulos: r.titulos || [], limite: r.limite, updated_at: new Date().toISOString() };
      setData(next);
      write(key, next);
    } catch (err) {
      setError(err?.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setData(read(key)); carregar(); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading, error, carregar };
}