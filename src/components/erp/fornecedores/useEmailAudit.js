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
      }
    } finally {
      setState(stop.current ? "stopped" : "done");
    }
  };

  return { results, state, progress, run, cancel: () => { stop.current = true; } };
}