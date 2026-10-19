import { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { onlyDigits } from "@/lib/erpFormat";
import { validCnpj } from "./emailAudit";

// Consulta os CNPJs válidos em lotes de 25; falhas de lote viram "erro" por CNPJ.
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
    for (let i = 0; i < cnpjs.length && !stop.current; i += 25) {
      const batch = cnpjs.slice(i, i + 25);
      let out;
      try {
        out = (await base44.functions.invoke("auditSupplierEmails", { cnpjs: batch })).data.results;
      } catch (e) {
        out = batch.map((cnpj) => ({ cnpj, status: "error", error: e.message }));
      }
      setResults((r) => ({ ...r, ...Object.fromEntries(out.map((x) => [x.cnpj, x])) }));
      setProgress({ done: Math.min(i + 25, cnpjs.length), total: cnpjs.length });
    }
    setState(stop.current ? "stopped" : "done");
  };

  return { results, state, progress, run, cancel: () => { stop.current = true; } };
}