import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Radio, Play, AlertTriangle, CheckCircle2 } from "lucide-react";

export default function RdStationApiPanel() {
  const [catalog, setCatalog] = useState([]);
  const [product, setProduct] = useState(
    new URLSearchParams(window.location.search).get("product") || "crm",
  );
  const [endpoint, setEndpoint] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    base44.functions
      .invoke("rdStationRead", { catalog_only: true })
      .then((r) => {
        const list = r.data?.catalog || [];
        setCatalog(list);
        const initial = list.find((c) => c.product === product) || list[0];
        setEndpoint(initial?.endpoints?.[0]?.path || "");
      })
      .catch(() => setCatalog([]));
  }, []);

  const current = catalog.find((c) => c.product === product);

  const selectProduct = (p) => {
    setProduct(p);
    setResult(null);
    setError(null);
    setEndpoint(catalog.find((c) => c.product === p)?.endpoints?.[0]?.path || "");
  };

  const run = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await base44.functions.invoke("rdStationRead", { product, endpoint });
      if (r.data?.error) setError(r.data.error);
      else setResult(r.data);
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || String(e);
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const rows = Array.isArray(result?.data) ? result.data : result?.data?.deals || result?.data?.docs || null;

  return (
    <div className="border border-gray-800 rounded-xl p-5 bg-gray-900/40 mt-8">
      <h2 className="text-white font-semibold flex items-center gap-2">
        <Radio className="w-5 h-5 text-purple-400" /> APIs do RD Station (somente leitura)
      </h2>
      <p className="text-sm text-gray-500 mt-1">
        O Cérebro já sabe autenticar e ler dados do CRM, do Marketing e do Conversas. Escolha o produto e o recurso para
        conferir a conexão e ver os dados que ele consegue puxar.
      </p>

      <div className="flex flex-wrap gap-2 mt-4">
        {catalog.map((c) => (
          <button
            key={c.product}
            onClick={() => selectProduct(c.product)}
            className={`px-3 py-1.5 rounded-lg text-sm ${
              product === c.product ? "bg-purple-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {current && (
        <>
          <p className="text-xs text-gray-600 mt-3">
            {current.base_url} · autenticação: {current.auth}
          </p>

          <div className="flex flex-wrap items-end gap-2 mt-3">
            <label className="text-xs text-gray-400">
              Recurso
              <select
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                className="block mt-1 bg-gray-950 border border-gray-800 rounded-lg text-sm text-white px-3 py-2 min-w-64"
              >
                {current.endpoints.map((ep) => (
                  <option key={ep.path} value={ep.path}>
                    {ep.label} — /{ep.path}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={run}
              disabled={busy || !endpoint}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 disabled:opacity-50 text-white text-sm"
            >
              <Play className="w-4 h-4" /> {busy ? "Consultando…" : "Consultar"}
            </button>
          </div>

          <p className="text-xs text-gray-600 mt-2">
            {current.endpoints.find((ep) => ep.path === endpoint)?.description}
          </p>
        </>
      )}

      {error && (
        <div className="border border-red-700/50 bg-red-950/30 rounded-lg p-3 mt-4 text-sm text-red-300 flex gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {result && (
        <div className="mt-4">
          <div className="flex items-center gap-2 text-sm text-emerald-400">
            <CheckCircle2 className="w-4 h-4" /> HTTP {result.status} · {result.duration_ms} ms
            {rows ? ` · ${rows.length} registros` : ""}
          </div>
          <p className="text-xs text-gray-600 mt-1 break-all">{result.request_url}</p>
          <pre className="mt-2 max-h-80 overflow-auto bg-gray-950 border border-gray-800 rounded-lg p-3 text-xs text-gray-300">
            {JSON.stringify(result.data, null, 2).slice(0, 20000)}
          </pre>
        </div>
      )}
    </div>
  );
}