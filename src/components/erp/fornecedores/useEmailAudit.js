import { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { onlyDigits } from "@/lib/erpFormat";
import { validCnpj } from "./emailAudit";

// Lotes pequenos para a consulta não estourar o tempo limite; falhas de lote viram "erro" por CNPJ.
const BATCH = 5;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
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
        // Pausa entre lotes; maior quando o lote veio com muitas falhas (sinal de limite).
        const errs = out.filter((x) => x.status === "error").length;
        if (i + BATCH < cnpjs.length) await wait(errs >= Math.ceil(batch.length / 2) ? 10000 : 1500);
      }
      // Uma única rodada de repetição, devagar, só para os que falharam.
      if (failed.length && !stop.current) {
        await wait(20000);
        const retry = failed.splice(0);
        for (let i = 0; i < retry.length && !stop.current; i += BATCH) {
          const batch = retry.slice(i, i + BATCH);
          const res = await base44.functions.invoke("auditSupplierEmails", { cnpjs: batch }).catch(() => null);
          const out = res?.data?.results || [];
          setResults((r) => ({ ...r, ...Object.fromEntries(out.map((x) => [x.cnpj, x])) }));
          await wait(3000);
        }
      }
    } finally {
      setState(stop.current ? "stopped" : "done");
    }
  };

  return { results, state, progress, run, cancel: () => { stop.current = true; } };
}