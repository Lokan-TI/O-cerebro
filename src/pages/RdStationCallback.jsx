import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";

// Rota de retorno (callback) do OAuth do RD Station CRM.
// A RD Station redireciona para cá com ?code=... (ou ?error=...).
// A troca do code por access_token acontece no backend — nunca no frontend.
export default function RdStationCallback() {
  const [state, setState] = useState({ phase: "loading", message: "" });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const error = params.get("error_description") || params.get("error");

    // Devolve o retorno à tela de Integrações (logada), que conclui a troca. Nunca troca o código aqui.
    const msg = { type: "rd-oauth", code, state: params.get("state"), error };
    let delivered = false;
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(msg, "*");
      delivered = true;
    }
    if ("BroadcastChannel" in window) {
      const ch = new BroadcastChannel("rd-oauth");
      ch.postMessage(msg);
      ch.close();
      delivered = true;
    }
    if (!delivered) {
      setState({ phase: "error", message: "Não foi possível devolver o resultado à tela de Integrações. Feche esta janela e tente conectar novamente." });
      return;
    }
    setState({ phase: "pending", message: "Retorno enviado à tela de Integrações. Esta janela será fechada." });
    setTimeout(() => window.close(), 1200);
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-6">
      <div className="max-w-md w-full border border-gray-800 rounded-xl bg-gray-900/40 p-8 text-center">
        {state.phase === "loading" && (
          <>
            <Loader2 className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-4" />
            <p className="text-gray-400 text-sm">Processando autorização…</p>
          </>
        )}
        {state.phase === "pending" && (
          <>
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-4" />
            <h1 className="text-white font-semibold mb-2">Retorno recebido</h1>
            <p className="text-gray-400 text-sm">{state.message}</p>
          </>
        )}
        {state.phase === "error" && (
          <>
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-4" />
            <h1 className="text-white font-semibold mb-2">Autorização não concluída</h1>
            <p className="text-gray-400 text-sm">{state.message}</p>
          </>
        )}
        <a
          href="/Integracoes"
          className="inline-block mt-6 px-4 py-2 rounded-lg bg-purple-600 text-white text-sm"
        >
          Voltar para Integrações
        </a>
      </div>
    </div>
  );
}