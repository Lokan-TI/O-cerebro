import { useCallback, useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";

const APP_ORIGIN = "https://lokan-firstouch.base44.app";

// Autorização OAuth do RD Station Marketing: abre a janela da RD e conclui a troca ao receber o callback.
export function useRdOAuth(onConnected) {
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [manualUrl, setManualUrl] = useState(null);
  const stateRef = useRef(null);

  const load = useCallback(() => {
    base44.functions.invoke("rdStationOAuth", { action: "status" }).then((r) => setInfo(r.data));
  }, []);
  useEffect(load, [load]);

  useEffect(() => {
    let handled = null;
    const onMsg = async (ev) => {
      if (ev.data?.type !== "rd-oauth") return;
      if (ev.origin && ev.origin !== APP_ORIGIN && ev.origin !== window.location.origin) return;
      if (ev.data.code && handled === ev.data.code) return;
      handled = ev.data.code;
      if (ev.data.error || !ev.data.code) { setError(ev.data.error || "A RD não devolveu o código de autorização."); return; }
      setBusy(true); setError(null);
      const r = await base44.functions.invoke("rdStationOAuth", { action: "exchange", code: ev.data.code, state: ev.data.state || stateRef.current })
        .catch((e) => ({ data: { error: e?.response?.data?.error || e.message } }));
      if (r.data?.error) setError(r.data.error); else onConnected?.();
      setBusy(false); load();
    };
    window.addEventListener("message", onMsg);
    const ch = "BroadcastChannel" in window ? new BroadcastChannel("rd-oauth") : null;
    if (ch) ch.onmessage = (ev) => onMsg({ data: ev.data, origin: window.location.origin });
    return () => { window.removeEventListener("message", onMsg); ch?.close(); };
  }, [load, onConnected]);

  const connect = async () => {
    setBusy(true); setError(null); setManualUrl(null);
    const win = window.open("", "rd-oauth", "width=620,height=760");
    const r = await base44.functions.invoke("rdStationOAuth", { action: "start" })
      .catch((e) => ({ data: { error: e?.response?.data?.error || e.message } }));
    setBusy(false);
    if (r.data?.error) { win?.close(); setError(r.data.error); return; }
    stateRef.current = r.data.state;
    if (win && !win.closed) win.location.href = r.data.authorize_url;
    else setManualUrl(r.data.authorize_url);
  };

  return { info, busy, error, manualUrl, connect, reload: load };
}