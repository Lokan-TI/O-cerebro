import { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { onlyDigits } from "@/lib/erpFormat";
import { validCnpj } from "./emailAudit";

// Lotes pequenos para a consulta não estourar o tempo limite; falhas de lote viram "erro" por CNPJ.
const BATCH = 10;
export default function useEmailAudit() {
  const [results, setResults] = useState({});
  const [state, setState] = useState("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const stop = useRef(false);

  const run = async (suppliers) => {
    const cnpjs = [...new Set(suppliers.map((s) => onlyDigits(s.cnpj || "")).filter(validCnpj))];
    stop.current = false;
    setResults({});
    setState("running");
    setProgress({ done: 0, total: cnpjs.length });
    const failed = [];
    try {
      for (let i = 0; i < cnpjs.length && !stop.current; i += BATCH) {
        const batch = cnpjs.slice(i, i + BATCH);
        let out;
        try {
          const res = await base44.functions.invoke("auditSupplierEmails", { cnpjs: batch });
          if (!Array.isArray(res?.data?.results)) throw new Error(res?.data?.error || "Resposta inválida do servidor");
          out = res.data.results;
        } catch (e) {
          const msg = e?.response?.data?.error || e?.message || "Falha na consulta";
          out = batch.map((cnpj) => ({ cnpj, status: "error", error: msg }));
        }
        const got = new Set(out.map((x) => x.cnpj));
        out = [...out, ...batch.filter((c) => !got.has(c)).map((cnpj) => ({ cnpj, status: "error", error: "Sem retorno do servidor" }))];
        setResults((r) => ({ ...r, ...Object.fromEntries(out.map((x) => [x.cnpj, x])) }));
        setProgress({ done: Math.min(i + BATCH, cnpjs.length), total: cnpjs.length });
        out.forEach((x) => { if (x.status === "error") failed.push(x.cnpj); });
      }
      // Repassa os que falharam (limite temporário das fontes), devagar, até 2 rodadas.
      for (let round = 0; round < 2 && failed.length && !stop.current; round++) {
        await new Promise((r) => setTimeout(r, 15000));
        const retry = failed.splice(0);
        for (let i = 0; i < retry.length && !stop.current; i += 5) {
          const batch = retry.slice(i, i + 5);
          const res = await base44.functions.invoke("auditSupplierEmails", { cnpjs: batch }).catch(() => null);
          const out = res?.data?.results || [];
          const ok = out.filter((x) => x.status !== "error");
          setResults((r) => ({ ...r, ...Object.fromEntries(ok.map((x) => [x.cnpj, x])) }));
          const okSet = new Set(ok.map((x) => x.cnpj));
          failed.push(...batch.filter((c) => !okSet.has(c)));
          await new Promise((r) => setTimeout(r, 1500));
        }
      }
    } finally {
      setState(stop.current ? "stopped" : "done");
    }
  };

  return { results, state, progress, run, cancel: () => { stop.current = true; } };
}