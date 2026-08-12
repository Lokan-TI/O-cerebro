import { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { buildBrainContext } from "@/components/brain/buildBrainContext";
import { RENTAL_INDUSTRY_BRIEF } from "@/lib/rentalIndustry";
import InsightCard from "@/components/brain/InsightCard";
import { Loader2, Lightbulb } from "lucide-react";

const SCHEMA = {
  type: "object",
  properties: {
    insights: {
      type: "array",
      items: {
        type: "object",
        properties: {
          tipo: { type: "string", enum: ["oportunidade", "risco", "acao"] },
          titulo: { type: "string" },
          leitura: { type: "string" },
          acao: { type: "string" },
          referencia: { type: "string" },
        },
      },
    },
  },
};

export default function BrainInsights({ snapshot, sourceName }) {
  const ref = useRef(null);
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const asked = useRef(false);

  useEffect(() => {
    if (!snapshot || !ref.current) return;
    const io = new IntersectionObserver(async ([e]) => {
      if (!e.isIntersecting || asked.current) return;
      asked.current = true;
      setLoading(true);
      try {
        const res = await base44.integrations.Core.InvokeLLM({
          prompt: `Você é o "Cérebro" — consultor sênior especializado no setor de locação de máquinas e equipamentos.
${RENTAL_INDUSTRY_BRIEF}

DADOS REAIS DA OPERAÇÃO (snapshot do ERP Sisloc):
${buildBrainContext(snapshot, sourceName)}

Gere 6 dicas rápidas e acionáveis para melhorar o negócio, em português do Brasil.
Regras: cada dica cita um número real dos dados; compara com o benchmark do setor quando fizer sentido;
"leitura" com no máximo 2 frases; "acao" objetiva e executável em 30 dias;
"referencia" curta citando a prática de uma referência do ramo (Mills, Locar, Armac/APC, Loxam ou Casa do Construtor). Sem enrolação.`,
          response_json_schema: SCHEMA,
        });
        setInsights(res?.insights || []);
      } catch {
        setInsights([]);
      } finally {
        setLoading(false);
      }
    }, { threshold: 0.2 });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [snapshot, sourceName]);

  return (
    <div ref={ref} className="w-full max-w-5xl mx-auto px-6 pb-24">
      <div className="flex items-center gap-2 mb-6">
        <Lightbulb className="w-4 h-4 text-purple-400" />
        <h2 className="text-white font-semibold text-sm">Dicas rápidas para melhorar</h2>
        <span className="text-gray-600 text-xs">— dados da sua operação vs. práticas do setor</span>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-gray-500 text-sm py-10 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Cruzando seus dados com o mercado de locação…
        </div>
      )}

      {!loading && insights && insights.length === 0 && (
        <p className="text-gray-600 text-sm">Não foi possível gerar as dicas agora.</p>
      )}

      {!loading && insights && insights.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {insights.map((i, idx) => <InsightCard key={idx} insight={i} />)}
        </div>
      )}
    </div>
  );
}