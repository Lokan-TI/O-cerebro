import { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { onlyDigits } from "@/lib/erpFormat";
import { validCnpj } from "./emailAudit";

const BATCH = 5;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Busca dados públicos de todos os fornecedores com CNPJ válido, em lotes sequenciais, salvando a cada lote.
export default function usePublicEnrich(savePublic) {
  const [state, setState] = useState("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const stop = useRef(false);

  const run = async (suppliers) => {
    const byCnpj = {};
    suppliers.forEach((s) => { const c = onlyDigits(s.cnpj || ""); if (validCnpj(c)) (byCnpj[c] ||= []).push(s); });
    const cnpjs = Object.keys(byCnpj);
    stop.current = false;
    setState("running");
    setProgress({ done: 0, total: cnpjs.length });
    const call = async (batch) => {
      const res = await base44.functions.invoke("auditSupplierEmails", { cnpjs: batch }).catch((e) => ({ err: e?.message }));
      const out = res?.data?.results || [];
      const got = new Set(out.map((x) => x.cnpj));
      return [...out, ...batch.filter((c) => !got.has(c)).map((cnpj) => ({ cnpj, status: "error", error: res?.err || "Sem retorno" }))];
    };
    const persist = (out) => savePublic(out.flatMap((res) => byCnpj[res.cnpj].map((row) => ({ row, res }))));
    const failed = [];
    try {
      for (let i = 0; i < cnpjs.length && !stop.current; i += BATCH) {
        const out = await call(cnpjs.slice(i, i + BATCH));
        await persist(out);
        const errs = out.filter((x) => x.status === "error");
        failed.push(...errs.map((x) => x.cnpj));
        setProgress({ done: Math.min(i + BATCH, cnpjs.length), total: cnpjs.length });
        await wait(errs.length >= 3 ? 10000 : 1500);
      }
      if (failed.length && !stop.current) {
        await wait(15000);
        for (let i = 0; i < failed.length && !stop.current; i += BATCH) {
          await persist(await call(failed.slice(i, i + BATCH)));
          await wait(3000);
        }
      }
    } finally {
      setState(stop.current ? "stopped" : "done");
    }
  };

  return { state, progress, run, cancel: () => { stop.current = true; } };
}