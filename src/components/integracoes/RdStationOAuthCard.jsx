import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { KeyRound, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";

// Card de conexão OAuth com o RD Station (autoriza a conta e mostra o status).
export default function RdStationOAuthCard() {
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const load = () => {
    base44.functions
      .invoke("rdStationOAuth", { action: "status" })
      .then((r) => setInfo(r.data))
      .catch((e) => setError(e?.response?.data?.error || e.message));
  };
  useEffect(load, []);

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await base44.functions.invoke("rdStationOAuth", { action: "start" });
      window.location.href = r.data.authorize_url;
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
      setBusy(false);
    }
  };

  const check = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await base44.functions.invoke("rdStationOAuth", { action: "check" });
      if (r.data?.error) setError(r.data.error);
      load();
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  };

  const connected = info?.status === "connected";

  return (
    <div className="border border-gray-800 rounded-xl p-5 bg-gray-900/40 mt-8">
      <h2 className="text-white font-semibold flex items-center gap-2">
        <KeyRound className="w-5 h-5 text-purple-400" /> Conexão RD Station (OAuth)
      </h2>
      <p className="text-sm text-gray-500 mt-1">
        Autorize a conta RD Station uma única vez. O Cérebro guarda o acesso e renova sozinho.
      </p>

      <div className="flex items-center gap-2 mt-4 text-sm">
        {connected ? (
          <span className="flex items-center gap-2 text-emerald-400">
            <CheckCircle2 className="w-4 h-4" /> Conta conectada
          </span>
        ) : (
          <span className="text-gray-400">Conta não conectada</span>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        <button
          onClick={connect}
          disabled={busy}
          className="px-4 py-2 rounded-lg bg-purple-600 disabled:opacity-50 text-white text-sm"
        >
          {connected ? "Reconectar conta" : "Conectar conta RD Station"}
        </button>
        {connected && (
          <button
            onClick={check}
            disabled={busy}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 disabled:opacity-50 text-gray-200 text-sm"
          >
            <RefreshCw className="w-4 h-4" /> Testar acesso
          </button>
        )}
      </div>

      {info?.expires_at && (
        <p className="text-xs text-gray-600 mt-3">
          Acesso válido até {new Date(info.expires_at).toLocaleString("pt-BR")}
        </p>
      )}

      {(error || info?.last_error) && (
        <div className="border border-red-700/50 bg-red-950/30 rounded-lg p-3 mt-4 text-sm text-red-300 flex gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error || info.last_error}
        </div>
      )}
    </div>
  );
}