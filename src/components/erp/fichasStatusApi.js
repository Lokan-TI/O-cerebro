import { base44 } from "@/api/base44Client";

// O Sisloc atende uma consulta por vez: com a tela abrindo, a chamada pode esperar na fila até estourar o tempo.
// Repete até 3 vezes (só em falha de tempo ou de servidor) antes de devolver o erro.
export async function invokeFichasStatus(payload) {
  for (let attempt = 1; ; attempt++) {
    try {
      return (await base44.functions.invoke("listFichasStatus", payload)).data;
    } catch (e) {
      if (attempt === 3 || e?.response?.status < 500) throw e;
    }
  }
}