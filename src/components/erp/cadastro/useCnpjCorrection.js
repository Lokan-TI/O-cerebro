import { useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { computeDiffs, tipoLabel } from "./cnpjDiff";
import { saveRun } from "./cnpjRuns";

const digits = (s) => String(s || "").replace(/\D/g, "");

export default function useCnpjCorrection(sourceKey) {
  const [people, setPeople] = useState(null);
  const [results, setResults] = useState({});
  const [state, setState] = useState("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState("");
  const [savedTick, setSavedTick] = useState(0);
  const stop = useRef(false);

  const load = async (tipos) => {
    setState("loading"); setError(""); setResults({});
    const res = await base44.functions.invoke("cnpjCorrection", { action: "load", tipos, source_id: sourceKey === "all" ? undefined : sourceKey });
    if (res.data?.error) { setError(res.data.error); setState("idle"); return; }
    const { cols, rows } = res.data;
    setPeople(rows.map((r) => Object.fromEntries(cols.map((c, i) => [c, r[i]]))).map((p) => ({ ...p, cnpj: digits(p.nr_cnpj_pessoa).padStart(14, "0"), tipo: tipoLabel(p) })));
    setState("idle");
  };

  const toResult = (p, pub, at) => {
    const base = { cd_pessoa: String(p.cd_pessoa), cnpj: p.cnpj, nm_pessoa: p.nm_pessoa, tipo: p.tipo, consulted_at: at };
    if (!pub) return { ...base, status: "cnpj_invalido", diffs: [] };
    if (pub.status !== "ok") return { ...base, status: pub.status, fonte: pub.fonte, error: pub.error || "", diffs: [] };
    const diffs = computeDiffs(p, pub);
    return { ...base, status: diffs.length ? "divergente" : "sem_divergencia", fonte: pub.fonte, anonimizado: !!pub.anonimizado, diffs };
  };

  const run = async (tipos, onlyFailed = false) => {
    const list = onlyFailed ? people.filter((p) => results[p.cd_pessoa]?.status === "error") : people;
    const startedAt = new Date().toISOString();
    stop.current = false; setState("running");
    const byCnpj = {};
    for (const p of list) (byCnpj[p.cnpj] ||= []).push(p);
    const cnpjs = Object.keys(byCnpj);
    setProgress({ done: 0, total: cnpjs.length });
    const acc = onlyFailed ? { ...results } : {};
    for (let i = 0; i < cnpjs.length && !stop.current; i += 25) {
      const chunk = cnpjs.slice(i, i + 25);
      const res = await base44.functions.invoke("cnpjCorrection", { action: "lookup", cnpjs: chunk });
      const map = Object.fromEntries((res.data?.results || []).map((r) => [r.cnpj, r]));
      for (const c of chunk) for (const p of byCnpj[c]) acc[p.cd_pessoa] = toResult(p, map[c], res.data?.consulted_at);
      setResults({ ...acc });
      setProgress({ done: Math.min(i + 25, cnpjs.length), total: cnpjs.length });
    }
    const final = stop.current ? "stopped" : "done";
    setState(final);
    await saveRun({ sourceKey, tipos, startedAt, status: final, results: Object.values(acc) });
    setSavedTick((n) => n + 1);
  };

  return { people, results, state, progress, error, savedTick, load, run, cancel: () => { stop.current = true; } };
}