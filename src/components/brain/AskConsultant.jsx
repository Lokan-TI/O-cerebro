import { useState } from "react";
import { base44 } from "@/api/base44Client";
import ReactMarkdown from "react-markdown";
import { buildBrainContext, SUGGESTED_QUESTIONS } from "@/components/brain/buildBrainContext";
import { RENTAL_INDUSTRY_BRIEF } from "@/lib/rentalIndustry";
import { BrainCircuit, Send, Loader2, Sparkles, User } from "lucide-react";

export default function AskConsultant({ snapshot, sourceName }) {
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState([]);
  const [thinking, setThinking] = useState(false);

  const ask = async (q) => {
    const text = (q || question).trim();
    if (!text || thinking) return;
    setQuestion("");
    setThinking(true);
    setHistory((h) => [...h, { role: "user", text }]);
    const context = buildBrainContext(snapshot, sourceName);
    try {
      const answer = await base44.integrations.Core.InvokeLLM({
        prompt: `Você é o "Cérebro" — um consultor executivo sênior de uma locadora de equipamentos que usa o ERP Sisloc.
Responda em português do Brasil, de forma direta e prática, citando números reais dos dados abaixo.
Estruture: leitura rápida do cenário → 2 a 4 insights com números → recomendação de ação clara.
Compare sempre com as práticas e benchmarks do setor abaixo quando fizer sentido.
${RENTAL_INDUSTRY_BRIEF}
Use markdown leve (negrito, listas curtas). Máximo ~250 palavras. Se os dados não cobrirem a pergunta, diga o que falta e sugira onde olhar (abas ERP: Visão Executiva, Financeiro, Retenção & Churn, Clientes).

DADOS ATUAIS DO NEGÓCIO (snapshot pré-calculado):
${context || "Sem dados carregados — oriente o usuário a atualizar os dados no Dashboard ERP."}

PERGUNTA DO GESTOR: ${text}`,
      });
      setHistory((h) => [...h, { role: "brain", text: answer }]);
    } catch {
      setHistory((h) => [...h, { role: "brain", text: "Não consegui processar agora. Tente novamente em instantes." }]);
    } finally {
      setThinking(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Histórico da conversa */}
      {history.length > 0 && (
        <div className="space-y-4 mb-6">
          {history.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
              {m.role === "brain" && (
                <div className="w-8 h-8 rounded-full bg-purple-600/20 border border-purple-500/40 flex items-center justify-center shrink-0">
                  <BrainCircuit className="w-4 h-4 text-purple-400" />
                </div>
              )}
              <div className={`rounded-2xl px-4 py-3 text-sm max-w-[85%] ${
                m.role === "user"
                  ? "bg-purple-600 text-white"
                  : "bg-gray-900 border border-gray-800 text-gray-200"
              }`}>
                {m.role === "brain" ? (
                  <div className="prose prose-invert prose-sm max-w-none [&_strong]:text-purple-300 [&_li]:my-0.5">
                    <ReactMarkdown>{m.text}</ReactMarkdown>
                  </div>
                ) : m.text}
              </div>
              {m.role === "user" && (
                <div className="w-8 h-8 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-gray-400" />
                </div>
              )}
            </div>
          ))}
          {thinking && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-600/20 border border-purple-500/40 flex items-center justify-center shrink-0">
                <BrainCircuit className="w-4 h-4 text-purple-400 animate-pulse" />
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 text-sm text-gray-400 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Analisando os dados…
              </div>
            </div>
          )}
        </div>
      )}

      {/* Caixa de pergunta */}
      <form
        onSubmit={(e) => { e.preventDefault(); ask(); }}
        className="relative"
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Pergunte ao cérebro da operação… ex: como está o churn?"
          className="w-full bg-gray-900/80 backdrop-blur border border-gray-700 focus:border-purple-500 rounded-2xl pl-5 pr-14 py-4 text-white text-sm outline-none shadow-lg shadow-purple-950/30 transition-colors"
        />
        <button
          type="submit"
          disabled={thinking || !question.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 flex items-center justify-center transition-colors"
          aria-label="Enviar pergunta"
        >
          {thinking ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Send className="w-4 h-4 text-white" />}
        </button>
      </form>

      {/* Sugestões */}
      <div className="flex flex-wrap justify-center gap-2 mt-4">
        {SUGGESTED_QUESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => ask(s)}
            disabled={thinking}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900/60 hover:bg-gray-800 border border-gray-800 hover:border-purple-600/50 rounded-full text-xs text-gray-400 hover:text-purple-300 transition-colors disabled:opacity-40"
          >
            <Sparkles className="w-3 h-3 text-purple-500" /> {s}
          </button>
        ))}
      </div>
    </div>
  );
}