import { useCallback, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

// Recurso leve usado só para conferir se a credencial de cada API está válida.
export const RD_HEALTH_ENDPOINT = {
  crm: "token/check",
  marketing: "marketing/account_info",
  conversas: "employees",
};

// Estado de conexão das APIs do RD Station: usado no menu lateral e no painel de fontes.
export function useRdStatus() {
  const [catalog, setCatalog] = useState([]);
  const [status, setStatus] = useState({}); // { product: { ok, message, checking } }
  const [loading, setLoading] = useState(true);

  const check = useCallback(async (product) => {
    setStatus((s) => ({ ...s, [product]: { ...(s[product] || {}), checking: true } }));
    try {
      const r = await base44.functions.invoke("rdStationRead", {
        product,
        endpoint: RD_HEALTH_ENDPOINT[product] || "",
      });
      const ok = !!r.data?.ok;
      setStatus((s) => ({
        ...s,
        [product]: { ok, checking: false, message: ok ? `HTTP ${r.data.status}` : r.data?.error || "Falha na leitura" },
      }));
      return ok;
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || String(e);
      setStatus((s) => ({ ...s, [product]: { ok: false, checking: false, message: msg } }));
      return false;
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await base44.functions.invoke("rdStationRead", { catalog_only: true });
        const list = r.data?.catalog || [];
        if (!alive) return;
        setCatalog(list);
        for (const c of list) {
          if (!alive) return;
          await check(c.product);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [check]);

  return { catalog, status, loading, check };
}