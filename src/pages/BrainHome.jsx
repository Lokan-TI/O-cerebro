import { useBrainSnapshot } from "@/components/brain/useBrainSnapshot";
import AskConsultant from "@/components/brain/AskConsultant";
import BrainShortcuts from "@/components/brain/BrainShortcuts";
import BrainInsights from "@/components/brain/BrainInsights";
import { BrainCircuit, Loader2, ChevronDown } from "lucide-react";

export default function BrainHome() {
  const { snapshot, loading, source } = useBrainSnapshot();

  return (
    <div className="min-h-screen bg-gray-950 relative">
      {/* Fundo tecnológico */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full bg-purple-700/10 blur-3xl" />
        <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(148,113,255,0.06) 1px, transparent 0)", backgroundSize: "32px 32px" }} />
      </div>

      {/* Dobra 1 — o cérebro */}
      <section className="relative min-h-[calc(100vh-53px)] flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-3xl flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-900/50 mb-6">
            <BrainCircuit className="w-7 h-7 text-white" />
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-white text-center tracking-tight leading-[1.1]">
            Os dados já sabem.
            <br />
            <span className="text-purple-400">A decisão é sua.</span>
          </h1>
          <p className="text-gray-500 text-sm text-center mt-4 mb-8">
            {source?.name ? `Base ${source.name}` : "Base conectada"}
            {snapshot?.max_date ? ` · dados até ${snapshot.max_date}` : ""}
          </p>

          {loading ? (
            <div className="flex items-center gap-2 text-gray-500 text-sm py-10">
              <Loader2 className="w-4 h-4 animate-spin" /> Conectando ao cérebro…
            </div>
          ) : (
            <AskConsultant snapshot={snapshot} sourceName={source?.name} />
          )}
        </div>

        <div className="absolute bottom-6 flex flex-col items-center gap-1 text-gray-600">
          <span className="text-[11px] uppercase tracking-widest">Dicas rápidas</span>
          <ChevronDown className="w-4 h-4 animate-bounce" />
        </div>
      </section>

      {/* Dobra 2 — dicas com base nos dados + mercado */}
      <section className="relative pt-8">
        {!loading && <BrainInsights snapshot={snapshot} sourceName={source?.name} />}
        <div className="max-w-5xl mx-auto px-6 pb-16">
          <BrainShortcuts />
        </div>
      </section>
    </div>
  );
}