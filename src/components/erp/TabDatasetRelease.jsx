import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { PackageCheck, Loader2, ShieldCheck, Play } from "lucide-react";
import { useErpSource, ALL_SOURCES_ID } from "@/lib/ErpSourceContext";
import ReleaseGateList from "./ReleaseGateList";

const YEARS = [2026, 2025, 2024, 2023];

export default function TabDatasetRelease() {
  const { selectedSource } = useErpSource();
  const selectedSourceId =
    selectedSource && selectedSource.id !== ALL_SOURCES_ID ? selectedSource.id : null;
  const [year, setYear] = useState(2025);
  const [current, setCurrent] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadCurrent = async () => {
    const list = await base44.entities.DatasetRelease.filter(
      selectedSourceId ? { source_id: selectedSourceId } : {},
      "-created_date",
      1
    );
    setCurrent(list?.[0] || null);
  };

  useEffect(() => { setPreview(null); loadCurrent(); }, [selectedSourceId]);

  const run = async (dry) => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("publishDatasetRelease", {
        source_id: selectedSourceId || undefined,
        year,
        dry_run: dry,
      });
      if (res.data?.error) throw new Error(res.data.error);
      setPreview(res.data.release);
      if (!dry) await loadCurrent();
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const shown = preview || current;

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-purple-400" /> Publicação de Dataset (Release atômico)
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Uma release congela snapshot, versões do registry e a reconciliação. Só publica com todos os portões aprovados.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Ano da reconciliação</label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200"
            >
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <button
            onClick={() => run(true)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm text-gray-200 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Verificar portões
          </button>
          <button
            onClick={() => run(false)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm text-white disabled:opacity-50"
          >
            <ShieldCheck className="w-4 h-4" /> Publicar release
          </button>
        </div>
      </div>

      {error && <div className="p-3 bg-red-950/40 border border-red-900 rounded-lg text-sm text-red-300">{error}</div>}

      {!shown && !loading && (
        <p className="text-sm text-gray-500">Nenhuma release apurada. Verifique os portões para ver o que falta antes de publicar.</p>
      )}

      {shown && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-mono text-gray-400">{shown.version}</span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
              shown.status === "published" ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
              : shown.status === "superseded" ? "bg-gray-800 text-gray-400 border border-gray-700"
              : "bg-red-950 text-red-300 border border-red-900"
            }`}>
              {shown.status === "published" ? "PUBLICADA" : shown.status === "superseded" ? "SUBSTITUÍDA" : "BLOQUEADA"}
            </span>
            {preview && <span className="text-xs text-amber-400">simulação — nada foi gravado</span>}
            <span className="text-xs text-gray-500">Snapshot {shown.snapshot_version || "—"} · dados até {shown.snapshot_max_date || "—"}</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Métricas comparadas", value: shown.metrics_total },
              { label: "Aderentes", value: shown.metrics_match },
              { label: "Divergentes", value: shown.metrics_fail },
              { label: "Sem justificativa", value: shown.metrics_unjustified },
            ].map((k) => (
              <div key={k.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-500">{k.label}</p>
                <p className="text-2xl font-semibold text-white mt-1">{k.value ?? 0}</p>
              </div>
            ))}
          </div>

          <ReleaseGateList gates={shown.gates || []} />

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-sm font-medium text-gray-200 mb-2">Versões do registry congeladas</p>
            <div className="space-y-1">
              {(shown.registry_versions || []).map((m) => (
                <div key={m.metric_id} className="flex items-center gap-3 text-xs">
                  <span className="font-mono text-gray-500 w-16">{m.metric_id}</span>
                  <span className="text-gray-300 flex-1">{m.business_name}</span>
                  <span className="text-gray-500">v{m.version}</span>
                  <span className={m.trusted ? "text-emerald-400" : "text-amber-400"}>
                    {m.trusted ? "OFICIAL" : "NÃO OFICIAL"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}