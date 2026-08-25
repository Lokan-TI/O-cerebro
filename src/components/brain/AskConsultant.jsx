import { useState } from "react";
import { base44 } from "@/api/base44Client";
import ReactMarkdown from "react-markdown";
import { buildBrainContext, SUGGESTED_QUESTIONS } from "@/components/brain/buildBrainContext";
import { useErpSource, ALL_SOURCES_ID } from "@/lib/ErpSourceContext";
import { useGlobalFilter } from "@/lib/GlobalFilterContext";
import BrainTeachBox from "@/components/brain/BrainTeachBox";
import BrainReportDownload from "@/components/brain/BrainReportDownload";
import { BrainCircuit, Send, Loader2, Sparkles, User, Database } from "lucide-react";

export default function AskConsultant({ snapshot, sourceName }) {
  const { selectedSource } = useErpSource() || {};
  const { period } = useGlobalFilter() || {};
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState([]);
  const [thinking, setThinking] = useState(false);

  const ask = async (q) => {
    const text = (q || question).trim();
    if (!text || thinking) return;
    setQuestion("");
    setThinking(true);
    const priorTurns = history.slice(-6).map((m) => ({
      role: m.role,
      text: m.text,
      sql: m.sql || "",
    }));
    setHistory((h) => [...h, { role: "user", text }]);
    const context = buildBrainContext(snapshot, sourceName);
    // Caminho principal: backend consulta o banco ao vivo (SQL somente leitura) e responde com dados reais.
    try {
      const sourceId =
        selectedSource?.id && selectedSource.id !== ALL_SOURCES_ID ? selectedSource.id : null;
      const res = await base44.functions.invoke("brainAsk", {
        question: text,
        source_id: sourceId,
        context: context || "",
        conversation: priorTurns,
        period_start: period?.start || null,
        period_end_inclusive: period?.end || null,
        period_end_exclusive: period?.endExclusive || null,
      });
      if (res?.data?.answer) {
        setHistory((h) => [
          ...h,
          {
            role: "brain",
            text: res.data.answer,
            queried: !!res.data.sql,
            sql: res.data.sql || "",
            tables: res.data.tables || [],
            rows: res.data.rows || [],
            question: text,
          },
        ]);
        setThinking(false);
        return;
      }
    } catch {
      // cai para o modo somente-snapshot abaixo
    }
    try {
      const answer = await base44.integrations.Core.InvokeLLM({
        prompt: `Você é o "Cérebro" — um consultor executivo sênior de uma locadora de equipamentos que usa o ERP Sisloc.
Responda em português do Brasil, de forma direta e objetiva, citando números reais dos dados abaixo.
REGRA ESSENCIAL: responda EXCLUSIVAMENTE o que foi perguntado. NÃO adicione insights extras, riscos, benchmarks, análises paralelas, recomendações, próximos passos nem observações não solicitadas.
Use markdown leve (negrito, listas curtas). Máximo ~120 palavras. Se os dados não cobrirem a pergunta, diga o que falta e sugira onde olhar (abas ERP: Visão Executiva, Financeiro, Retenção & Churn, Clientes).

${priorTurns.length ? `CONVERSA ANTERIOR (a pergunta pode ser continuação dela — mantenha o mesmo contexto e período):\n${priorTurns.map((t) => `${t.role === "user" ? "GESTOR" : "CÉREBRO"}: ${t.text}`).join("\n")}\n` : ""}
PERÍODO GLOBAL APLICADO NA TELA: ${period?.start || "não informado"} → ${period?.end || "não informado"} (fim exclusivo SQL: ${period?.endExclusive || "não informado"}).
Se a pergunta não citar outro período, responda usando exatamente esta janela.

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
                    {m.queried && (
                      <div className="not-prose mt-2 pt-2 border-t border-gray-800">
                        <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                          <Database className="w-3 h-3 text-purple-500" /> Consultado ao vivo no banco do ERP
                          {m.tables?.length > 0 && <span className="text-gray-600">· {m.tables.join(", ")}</span>}
                        </div>
                      </div>
                    )}
                    <BrainReportDownload rows={m.rows} question={m.question} answer={m.text} />
                    {m.question && (
                      <BrainTeachBox
                        question={m.question}
                        sql={m.sql}
                        sourceId={selectedSource?.id !== ALL_SOURCES_ID ? selectedSource?.id : null}
                      />
                    )}
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