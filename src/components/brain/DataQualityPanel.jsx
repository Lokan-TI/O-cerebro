import { useMemo } from "react";
import { buildQualityChecks, buildBenchmarks, qualityScore } from "@/lib/dataQuality";
import StatusPill from "@/components/brain/StatusPill";
import { ShieldCheck, Gauge } from "lucide-react";

export default function DataQualityPanel({ snapshot }) {
  const checks = useMemo(() => buildQualityChecks(snapshot), [snapshot]);
  const benchmarks = useMemo(() => buildBenchmarks(snapshot), [snapshot]);
  const score = qualityScore(checks);

  if (!snapshot) return null;

  const scoreTone = score >= 80 ? "text-green-400" : score >= 60 ? "text-amber-400" : "text-red-400";

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      {/* Qualidade e congruência */}
      <div className="bg-gray-900/60 backdrop-blur border border-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
          <h3 className="text-white font-semibold text-sm flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-purple-400" /> Qualidade e congruência dos dados
          </h3>
          <div className="text-right">
            <div className={`text-2xl font-bold ${scoreTone}`}>{score}/100</div>
            <div className="text-[11px] text-gray-500">Índice de confiabilidade</div>
          </div>
        </div>
        <div className="space-y-3">
          {checks.map((c, i) => (
            <div key={i} className="flex items-start gap-3 border-b border-gray-800/60 pb-3 last:border-0 last:pb-0">
              <div className="pt-0.5"><StatusPill status={c.status} showLabel={false} /></div>
              <div>
                <div className="text-sm text-white font-medium">{c.label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{c.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Benchmark de mercado */}
      <div className="bg-gray-900/60 backdrop-blur border border-gray-800 rounded-xl p-5">
        <h3 className="text-white font-semibold text-sm flex items-center gap-2 mb-1">
          <Gauge className="w-4 h-4 text-purple-400" /> Pontos de atenção para a diretoria
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          Comparação dos seus indicadores com faixas de referência praticadas por grandes locadoras.
        </p>
        <div className="space-y-4">
          {benchmarks.map((b, i) => (
            <div key={i} className="border-b border-gray-800/60 pb-4 last:border-0 last:pb-0">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="text-sm text-white font-medium">{b.label}</div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-white">{b.display}</span>
                  <span className="text-[11px] text-gray-500">mercado: {b.market}</span>
                  <StatusPill status={b.status} />
                </div>
              </div>
              <div className="text-xs text-gray-400 mt-1.5 leading-relaxed">{b.advice}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}