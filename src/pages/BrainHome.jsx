import { useBrainSnapshot } from "@/components/brain/useBrainSnapshot";
import AskConsultant from "@/components/brain/AskConsultant";
import BrainShortcuts from "@/components/brain/BrainShortcuts";
import { BrainCircuit, Loader2 } from "lucide-react";

export default function BrainHome() {
  const { snapshot, loading, source } = useBrainSnapshot();

  return (
    <div className="min-h-[calc(100vh-53px)] bg-gray-950 relative overflow-hidden flex items-center">
      {/* Fundo tecnológico */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full bg-purple-700/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-blue-700/10 blur-3xl" />
        <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(148,113,255,0.08) 1px, transparent 0)", backgroundSize: "32px 32px" }} />
      </div>

      <div className="relative w-full max-w-5xl mx-auto px-6 py-12 flex flex-col items-center justify-center">
        {/* Hero */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-900/50 mb-5">
          <BrainCircuit className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white text-center tracking-tight">
          Cérebro da Operação
        </h1>
        <p className="text-gray-400 text-sm md:text-base text-center mt-2 mb-8 max-w-xl">
          Seu consultor de decisões. Pergunte qualquer coisa sobre o negócio — as respostas usam os dados reais
          {source?.name ? <> da base <span className="text-purple-300 font-medium">{source.name}</span></> : null}
          {snapshot?.max_date ? <> (atualizados até {snapshot.max_date})</> : null}.
        </p>

        {/* Consultor */}
        {loading ? (
          <div className="flex items-center gap-2 text-gray-500 text-sm py-10">
            <Loader2 className="w-4 h-4 animate-spin" /> Conectando ao cérebro…
          </div>
        ) : (
          <AskConsultant snapshot={snapshot} sourceName={source?.name} />
        )}

        {/* Atalhos discretos */}
        <div className="w-full mt-12">
          <BrainShortcuts />
        </div>
      </div>
    </div>
  );
}