import { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";

// Orçamentos x locações fechadas por cliente, cada um com seu próprio período.
const memo = new Map();

export default function useOrcLoc(sourceId, orc, loc, empresa) {
  const [state, setState] = useState({ loading: false, data: null, error: null });
  const key = `${sourceId || "all"}|${orc.start}|${orc.end}|${loc.start}|${loc.end}`;

  useEffect(() => {
    if (!orc.start || !orc.end || !loc.start || !loc.end) return;
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    if (!memo.has(key)) {
      const payload = { orc_start: orc.start, orc_end: orc.end, loc_start: loc.start, loc_end: loc.end };
      if (sourceId) payload.source_id = sourceId;
      memo.set(key, base44.functions.invoke("listOrcamentosLocacoes", payload).then((r) => {
        if (r.data?.success === false) throw new Error(r.data.error);
        return r.data;
      }).catch((e) => { memo.delete(key); throw e; }));
    }
    memo.get(key)
      .then((data) => alive && setState({ loading: false, data, error: null }))
      .catch((e) => alive && setState({ loading: false, data: null, error: e.message }));
    return () => { alive = false; };
  }, [key]);

  const byClient = useMemo(() => {
    const out = {};
    if (!state.data) return out;
    const add = (list, field) => list.forEach((r) => {
      if (empresa != null && Number(r.cd_empresa) !== Number(empresa)) return;
      const c = (out[r.cd_pessoa] ||= { orc: 0, loc: 0, ultimaLoc: null });
      c[field] += r.qtd;
      if (field === "loc" && (!c.ultimaLoc || r.ultimo > c.ultimaLoc)) c.ultimaLoc = r.ultimo;
    });
    add(state.data.orcamentos || [], "orc");
    add(state.data.locacoes || [], "loc");
    return out;
  }, [state.data, empresa]);

  return { ...state, byClient };
}